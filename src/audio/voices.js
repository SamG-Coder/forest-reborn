import {voiceProfile,voiceCacheKey,spokenText} from './voice-profiles.js';
import {showSpeech} from './speech-bubbles.js';
import {concatSpeech} from './speech-chunks.js';
import {SpeechPlayback} from './speech-playback.js';

const PRIORITY={ambient:1,guard:2,dialogue:3,cinematic:4,preview:4};

/** Shared runtime speech: phrase generation, progressive playback and identity. */
export class CharacterVoices {
  constructor({getContext,onStatus=()=>{}}){
    Object.assign(this,{getContext,onStatus});this.pending=new Map();this.cache=new Map();this.channels=new Map();
    this.nextId=0;this.muted=false;this.paused=false;this.status='Voices not loaded';this.playbackEvents=[];
    this.metrics={generated:0,cacheHits:0,lastGenerationMs:0,cacheBytes:0,firstAudioMs:0};
  }
  request(data,onChunk){
    if(!this.worker){
      this.worker=new Worker(new URL('./speech-worker.js',import.meta.url),{type:'module'});
      this.worker.onmessage=({data:reply})=>{
        if(reply.status){this.status=reply.status;this.onStatus(reply.status);return;}
        const job=this.pending.get(reply.id);if(!job)return;
        if(reply.chunk){job.renew();job.onChunk?.(reply);return;}
        clearTimeout(job.timer);this.pending.delete(reply.id);
        if(reply.error){this.status='Voice unavailable · subtitles remain on';this.onStatus(this.status);job.reject(new Error(reply.error));}
        else job.resolve(reply.cancelled?null:reply);
      };
      this.worker.onerror=error=>{
        for(const job of this.pending.values()){clearTimeout(job.timer);job.reject(new Error(error.message));}
        this.pending.clear();this.status='Voice unavailable · subtitles remain on';this.onStatus(this.status);
      };
    }
    const id=++this.nextId;
    const promise=new Promise((resolve,reject)=>{
      const job={resolve,reject,onChunk,renew:()=>{clearTimeout(job.timer);job.timer=setTimeout(()=>{this.pending.delete(id);this.worker.postMessage({type:'cancel',id});reject(new Error('Speech request timed out.'));},30000);}};
      job.renew();this.pending.set(id,job);this.worker.postMessage({...data,id});
    });
    promise.jobId=id;return promise;
  }
  warm(){return this.warming??=this.request({type:'warm'}).catch(error=>{this.lastError=error.message;return null;});}

  entry(person,text,{prefetch=false,priority=0}={}){
    const profile=voiceProfile(person),clean=spokenText(text),key=voiceCacheKey(profile,clean);if(!clean)return null;
    let entry=this.cache.get(key);
    if(entry){
      this.metrics.cacheHits++;entry.prefetch||=prefetch;
      if(priority>entry.priority){entry.priority=priority;if(!entry.done)this.worker.postMessage({type:'priority',id:entry.request.jobId,priority});}
      return entry;
    }
    entry={key,profile,chunks:[],listeners:new Set(),done:false,prefetch,priority,bytes:0};this.cache.set(key,entry);
    entry.request=this.request({type:'generate',text:clean,profile,priority},chunk=>{
      entry.chunks.push(chunk);entry.bytes+=chunk.pcm.byteLength;if(this.cache.get(key)===entry)this.metrics.cacheBytes+=chunk.pcm.byteLength;
      for(const listener of entry.listeners)listener(chunk);
    });
    entry.promise=entry.request.then(reply=>{
      entry.done=true;
      if(!reply){this.evict(entry);return null;}
      const pcm=concatSpeech(entry.chunks);entry.bytes+=pcm.byteLength;this.metrics.cacheBytes+=pcm.byteLength;
      this.metrics.generated++;this.metrics.lastGenerationMs=reply.generationMs;
      entry.result={...reply,pcm,sampleRate:24000,profile,chunks:entry.chunks};this.trimCache();return entry.result;
    }).catch(error=>{entry.done=true;this.evict(entry);this.lastError=error.message;return null;});
    return entry;
  }
  evict(entry){if(this.cache.get(entry.key)!==entry)return;this.cache.delete(entry.key);this.metrics.cacheBytes-=entry.bytes;}
  trimCache(){
    for(const entry of this.cache.values()){
      if(this.cache.size<=24&&this.metrics.cacheBytes<=32*1024*1024)break;
      if(entry.done&&!entry.listeners.size)this.evict(entry);
    }
  }
  async prepare(person,text){return this.entry(person,text,{prefetch:true})?.promise??null;}

  speak(person,text,{channel='dialogue',volume=1,maxDelay=15000}={}){
    if(channel!=='ambient')this.stop('ambient');this.stop(channel);
    const clean=spokenText(text),bubble=showSpeech(person,clean);if(this.muted||!clean)return Promise.resolve(false);
    if(bubble)bubble.pending=true;
    const token={person,text:clean,bubble,queued:performance.now(),playing:false,received:[],profile:voiceProfile(person)};
    let resolveStarted;const started=new Promise(resolve=>{resolveStarted=resolve;});
    this.channels.set(channel,token);
    const finish=cancelled=>{
      if(token.finished)return;token.finished=true;token.playing=false;token.detach?.();token.cleanup?.();resolveStarted(false);
      if(bubble){bubble.pending=false;bubble.playing=false;bubble.expiresAt=Math.max(bubble.expiresAt,Date.now()+1500);}
      this.playbackEvents.push({channel,id:person.id,text:clean,cancelled,duration:token.playback?.duration??0,chunks:token.playback?.chunks??0,firstAudioMs:token.firstAudioMs??null,underruns:token.playback?.underruns??0});
      if(this.playbackEvents.length>64)this.playbackEvents.shift();
      if(this.channels.get(channel)===token)this.channels.delete(channel);this.trimCache();
    };
    token.finish=finish;
    const initialize=async()=>{
      const context=this.getContext();if(!context){this.stop(channel);return;}
      if(context.state==='suspended'&&!this.paused)await context.resume();
      if(this.channels.get(channel)!==token||token.finished)return;
      const eq=context.createBiquadFilter(),gain=context.createGain(),mixer=this.mixer??context.gameAudio;
      eq.type='lowshelf';eq.frequency.value=350;eq.gain.value=token.profile.warmth;gain.gain.value=.8*volume;
      const spatial=person.position&&mixer?mixer.spatialInput(()=>({x:person.position.x,y:person.position.y+1.5,z:person.position.z}),{bus:'voices',range:channel==='guard'?48:34}):null;
      eq.connect(gain);gain.connect(spatial?.input??mixer?.destination('voices')??context.destination);
      token.cleanup=()=>{eq.disconnect();gain.disconnect();spatial?.dispose();};
      token.playback=new SpeechPlayback(context,eq,{rate:Math.pow(2,token.profile.pitch/12),onStart:()=>{
        token.playing=true;token.firstAudioMs=performance.now()-token.queued;this.metrics.firstAudioMs=token.firstAudioMs;
        if(bubble){bubble.pending=false;bubble.playing=true;}resolveStarted(true);
      },onEnd:finish});
      token.playback.setPaused(this.paused);
      for(const chunk of token.received.splice(0))token.playback.push(chunk.pcm,chunk.sampleRate);
      if(token.inputDone)token.playback.finish();
    };
    const receive=chunk=>{
      if(this.channels.get(channel)!==token||token.finished)return;
      if(!token.playing&&performance.now()-token.queued>maxDelay){this.stop(channel);return;}
      if(token.playback)token.playback.push(chunk.pcm,chunk.sampleRate);
      else{token.received.push(chunk);token.initializing??=initialize().catch(error=>{this.lastError=error.message;this.stop(channel);});}
    };
    const entry=this.entry(person,clean,{priority:PRIORITY[channel]??3});
    token.detach=()=>{
      entry.listeners.delete(receive);
      if(!entry.done&&!entry.prefetch&&!entry.listeners.size){this.evict(entry);this.worker.postMessage({type:'cancel',id:entry.request.jobId});}
    };
    entry.listeners.add(receive);for(const chunk of entry.chunks)receive(chunk);
    entry.promise.then(result=>{
      if(this.channels.get(channel)!==token)return;
      if(!result){this.stop(channel);return;}token.inputDone=true;token.playback?.finish();
    });
    return started;
  }
  isSpeaking(id){return [...this.channels.values()].some(token=>token.person.id===id&&token.playing&&!this.paused);}
  busy(channel){return this.channels.has(channel);}
  stop(channel){const token=this.channels.get(channel);if(!token)return;this.channels.delete(channel);if(token.playback)token.playback.stop();else token.finish(true);}
  stopAll(){for(const channel of [...this.channels.keys()])this.stop(channel);}
  setMuted(value){this.muted=value;if(value)this.stopAll();}
  setPaused(value){if(this.paused===value)return;this.paused=value;for(const token of this.channels.values())token.playback?.setPaused(value);}
  dispose(){this.stopAll();this.worker?.terminate();for(const job of this.pending.values()){clearTimeout(job.timer);job.resolve(null);}this.pending.clear();this.cache.clear();this.metrics.cacheBytes=0;}
}

let shared;
/** Keep the warmed worker alive from save selection through creation and play. */
export function sharedVoices(options={}){shared??=new CharacterVoices({getContext:()=>null});Object.assign(shared,options);return shared;}
