import {voiceProfile, voiceCacheKey, spokenText} from './voice-profiles.js';
import {showSpeech} from './speech-bubbles.js';

/** Local runtime speech, shared by dialogue, cinematics and nearby world barks. */
export class CharacterVoices {
  constructor({getContext, onStatus = () => {}}) {
    Object.assign(this, {getContext, onStatus});
    this.pending = new Map(); this.cache = new Map(); this.channels = new Map();
    this.nextId = 0; this.muted = false; this.paused = false; this.status = 'Voices not loaded';
    this.metrics = {generated: 0, cacheHits: 0, lastGenerationMs: 0, cacheBytes: 0};
    this.cacheSizes=new Map();this.playbackEvents=[];
  }

  request(data) {
    if (!this.worker) {
      this.worker = new Worker(new URL('./speech-worker.js', import.meta.url), {type: 'module'});
      this.worker.onmessage = ({data: reply}) => {
        if (reply.status) { this.status = reply.status; this.onStatus(reply.status); return; }
        const job = this.pending.get(reply.id); if (!job) return;
        clearTimeout(job.timer); this.pending.delete(reply.id);
        if (reply.error) { this.status = 'Voice unavailable · subtitles remain on'; this.onStatus(this.status); job.reject(new Error(reply.error)); }
        else job.resolve(reply);
      };
      this.worker.onerror = error => {
        for (const job of this.pending.values()) { clearTimeout(job.timer); job.reject(new Error(error.message)); }
        this.pending.clear(); this.status = 'Voice unavailable · subtitles remain on'; this.onStatus(this.status);
      };
    }
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {this.pending.delete(id); reject(new Error('Speech request timed out.'));}, 30000);
      this.pending.set(id, {resolve, reject, timer}); this.worker.postMessage({...data, id});
    });
  }

  warm() { return this.warming ??= this.request({type: 'warm'}).catch(error => {this.lastError = error.message; return null;}); }

  async prepare(person, text) {
    const profile = voiceProfile(person), clean = spokenText(text), key = voiceCacheKey(profile, clean);
    if (!clean) return null;
    if (this.cache.has(key)) { this.metrics.cacheHits++; return this.cache.get(key); }
    const result = this.request({type: 'generate', text: clean, profile}).then(reply => {
      this.metrics.generated++; this.metrics.lastGenerationMs = reply.generationMs;
      this.metrics.cacheBytes += reply.pcm.byteLength;
      this.cacheSizes.set(key,reply.pcm.byteLength);
      // Keep at most 24 generated lines. Voice weights are cached separately on disk.
      while (this.cache.size > 24) { const oldest = this.cache.keys().next().value; this.cache.delete(oldest);this.metrics.cacheBytes-=this.cacheSizes.get(oldest)??0;this.cacheSizes.delete(oldest); }
      return {...reply, profile};
    }).catch(error => {this.cache.delete(key); this.lastError = error.message; return null;});
    this.cache.set(key, result);
    return result;
  }

  speak(person, text, {channel = 'dialogue', volume = 1, maxDelay = 15000} = {}) {
    if(channel!=='ambient')this.stop('ambient');
    this.stop(channel);
    const bubble=showSpeech(person,spokenText(text));
    if (this.muted || !spokenText(text)) return Promise.resolve(false);
    if(bubble)bubble.pending=true;
    const token = {person, text, bubble, queued: performance.now(), playing: false};
    this.channels.set(channel, token);
    return this.prepare(person, text).then(async result => {
      if (!result || this.channels.get(channel) !== token || this.muted || performance.now() - token.queued > maxDelay) {
        if(bubble){bubble.pending=false;bubble.expiresAt=Math.max(bubble.expiresAt,Date.now()+2500);}
        if (this.channels.get(channel) === token) this.channels.delete(channel);
        return false;
      }
      const context = this.getContext(); if (!context) {if(bubble)bubble.pending=false;this.channels.delete(channel); return false;}
      if(context.state==='suspended')await context.resume();
      if(this.channels.get(channel)!==token||this.muted)return false;
      const buffer = context.createBuffer(1, result.pcm.length, result.sampleRate);
      buffer.copyToChannel(result.pcm, 0);
      const source = context.createBufferSource(), eq = context.createBiquadFilter(), gain = context.createGain();
      source.buffer = buffer;
      token.rate = Math.pow(2, result.profile.pitch / 12);
      source.playbackRate.value = this.paused ? 0 : token.rate;
      eq.type = 'lowshelf'; eq.frequency.value = 350; eq.gain.value = result.profile.warmth;
      gain.gain.value = this.paused ? 0 : .8 * volume; token.volume = .8 * volume;
      source.connect(eq); eq.connect(gain); gain.connect(context.destination);
      Object.assign(token, {source, gain, eq, playing: true, started: context.currentTime});
      if(bubble){bubble.pending=false;bubble.playing=true;}
      source.onended = () => {if(bubble){bubble.playing=false;bubble.expiresAt=Math.max(bubble.expiresAt,Date.now()+1500);}this.playbackEvents.push({channel,id:person.id,text,cancelled:Boolean(token.cancelled),duration:buffer.duration/token.rate});if(this.playbackEvents.length>64)this.playbackEvents.shift();source.disconnect();eq.disconnect();gain.disconnect();if(this.channels.get(channel)===token)this.channels.delete(channel);};
      source.start(context.currentTime+.025); return true;
    });
  }

  isSpeaking(id) { return [...this.channels.values()].some(token => token.person.id === id && token.playing && !this.paused); }
  busy(channel) { return this.channels.has(channel); }
  stop(channel) { const token = this.channels.get(channel);if(token){token.cancelled=true;if(token.bubble){token.bubble.pending=false;token.bubble.playing=false;}}this.channels.delete(channel);try {token?.source?.stop();} catch {} }
  stopAll() { for (const channel of this.channels.keys()) this.stop(channel); }
  setMuted(value) {this.muted = value;if(value)this.stopAll();}
  setPaused(value) {
    if (this.paused === value) return; this.paused = value;
    for (const token of this.channels.values()) if(token.source) {token.source.playbackRate.value=value?0:token.rate;token.gain.gain.value=value?0:token.volume;}
  }
  dispose() {this.stopAll();this.worker?.terminate();for(const job of this.pending.values()){clearTimeout(job.timer);job.resolve(null);}this.pending.clear();this.cache.clear();}
}

let shared;
/** Keep the warmed worker alive from the save menu through creation and play. */
export function sharedVoices(options={}) {
  shared??=new CharacterVoices({getContext:()=>null});
  Object.assign(shared,options);return shared;
}
