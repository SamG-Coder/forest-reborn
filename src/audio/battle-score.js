/** Runtime battle accompaniment. Only the next beat is scheduled, so leaving
 * a battle, muting sound or opening a menu cannot leave a long audio queue. */
export class BattleScore {
  constructor(getAudio, voices) {
    this.getAudio = getAudio;
    this.voices = voices;
    this.nodes = new Set();
    this.beat = 0;
  }

  update(active, intensity = 0) {
    const context = active ? this.getAudio?.() : null;
    if (!context || context.state !== 'running') { this.stop(); return; }
    if (this.context !== context || !this.bus) {
      this.stop();
      this.context = context;
      this.bus = context.createGain();
      this.bus.gain.value = 0;
      this.bus.connect(context.gameAudio?.destination('music')??context.destination);
      this.nextBeat = context.currentTime + .05;
    }
    const speaking = ['dialogue', 'cinematic', 'guard'].some(channel => this.voices?.busy(channel));
    this.bus.gain.setTargetAtTime(speaking ? .014 : .045, context.currentTime, .2);
    if (this.nextBeat < context.currentTime) this.nextBeat = context.currentTime + .03;
    while (this.nextBeat < context.currentTime + .35) {
      this.schedule(this.nextBeat, Math.max(0, Math.min(1, intensity)));
      this.nextBeat += .4;
      this.beat++;
    }
  }

  tone(time, frequency, duration, volume, type = 'triangle', endFrequency) {
    const context = this.context, oscillator = context.createOscillator(), envelope = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, time);
    if (endFrequency) oscillator.frequency.exponentialRampToValueAtTime(endFrequency, time + duration);
    envelope.gain.setValueAtTime(0, time);
    envelope.gain.linearRampToValueAtTime(volume, time + .018);
    envelope.gain.exponentialRampToValueAtTime(.0001, time + duration);
    oscillator.connect(envelope);envelope.connect(this.bus);
    this.nodes.add(oscillator);
    oscillator.onended = () => { oscillator.disconnect();envelope.disconnect();this.nodes.delete(oscillator); };
    oscillator.start(time);oscillator.stop(time + duration + .02);
  }

  schedule(time, intensity) {
    // D minor, B-flat, F, C. Low drum hits and an ostinato leave room for voices.
    const roots = [73.416, 58.27, 87.307, 65.406], root = roots[Math.floor(this.beat / 8) % roots.length];
    const intervals = [2, 3, 4, 3, 2, 3, 4.5, 3];
    this.tone(time, root * intervals[this.beat % 8], .3, .28);
    if (this.beat % 4 === 0) this.tone(time, root, 1.15, .4, 'sine');
    if (this.beat % 2 === 0) this.tone(time, 130, .22, .65, 'sine', 42);
    if (intensity > .12 && this.beat % 2 === 1) this.tone(time, 190, .1, .15 + intensity * .18, 'triangle', 80);
  }

  stop() {
    if (!this.bus) return;
    const time = this.context.currentTime, bus = this.bus;
    bus.gain.cancelScheduledValues(time);
    bus.gain.setTargetAtTime(0, time, .05);
    for (const node of this.nodes) try { node.stop(time + .2); } catch { /* Already ended. */ }
    this.nodes.clear();this.bus = null;
    setTimeout(() => bus.disconnect(), 250);
  }

  dispose() { this.stop(); }
}
