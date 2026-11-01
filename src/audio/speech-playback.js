/** Schedule arriving PCM on the audio clock. Pausing retains every unplayed sample. */
export class SpeechPlayback {
  constructor(context,output,{rate=1,onStart=()=>{},onEnd=()=>{}}={}){
    Object.assign(this,{context,output,rate,onStart,onEnd});this.pending=[];this.active=new Set();
    this.started=false;this.paused=false;this.done=false;this.stopped=false;this.nextTime=0;this.duration=0;this.chunks=0;this.underruns=0;
  }
  push(pcm,sampleRate){
    if(this.stopped)return;const buffer=this.context.createBuffer(1,pcm.length,sampleRate);buffer.copyToChannel(pcm,0);
    this.duration+=buffer.duration/this.rate;this.chunks++;this.pending.push({buffer,offset:0});this.schedule();
  }
  schedule(){
    if(this.paused||this.stopped)return;
    while(this.pending.length){
      const item=this.pending.shift(),now=this.context.currentTime;
      if(this.started&&this.nextTime&&now>this.nextTime+.03)this.underruns++;
      const start=Math.max(now+.025,this.nextTime),source=this.context.createBufferSource();source.buffer=item.buffer;source.playbackRate.value=this.rate;source.connect(this.output);
      const entry={...item,source,start,end:start+(item.buffer.duration-item.offset)/this.rate,cancelled:false};this.nextTime=entry.end;this.active.add(entry);
      source.onended=()=>{source.disconnect();if(entry.cancelled)return;this.active.delete(entry);this.finishIfReady();};
      source.start(start,item.offset);
      if(!this.started){this.started=true;this.onStart();}
    }
    this.finishIfReady();
  }
  finish(){this.done=true;this.finishIfReady();}
  finishIfReady(){if(this.done&&!this.stopped&&!this.active.size&&!this.pending.length){this.stopped=true;this.onEnd(false);}}
  setPaused(paused){
    if(this.paused===paused||this.stopped)return;this.paused=paused;
    if(paused){
      const remaining=[],now=this.context.currentTime;
      for(const entry of this.active){
        const offset=entry.offset+Math.max(0,now-entry.start)*this.rate;
        if(offset<entry.buffer.duration)remaining.push({buffer:entry.buffer,offset});
        entry.cancelled=true;entry.source.stop();entry.source.disconnect();
      }
      this.active.clear();this.pending=[...remaining,...this.pending];this.nextTime=0;
    }else this.schedule();
  }
  stop(){
    if(this.stopped)return;this.stopped=true;
    for(const entry of this.active){entry.cancelled=true;try{entry.source.stop();}catch{}entry.source.disconnect();}
    this.active.clear();this.pending.length=0;this.onEnd(true);
  }
}
