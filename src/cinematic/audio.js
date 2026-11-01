/** Quiet procedural atmosphere. Lifecycle follows the cutscene, including skip/unload. */
export class OpeningAudio {
  constructor(context){this.context=context;this.nodes=[];this.hornPlayed=false;this.bellPlayed=false;}
  start(){
    const c=this.context;if(!c)return;
    const buffer=c.createBuffer(1,c.sampleRate*3,c.sampleRate),data=buffer.getChannelData(0);
    for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*.3;
    this.rain=c.createBufferSource();this.rain.buffer=buffer;this.rain.loop=true;
    const filter=c.createBiquadFilter();filter.type='lowpass';filter.frequency.value=2800;
    this.gain=c.createGain();this.gain.gain.value=.12;this.rain.connect(filter).connect(this.gain).connect(c.destination);this.rain.start();this.nodes.push(this.rain);
  }
  tone(frequency,duration,volume,type='sine'){
    const c=this.context;if(!c)return;const o=c.createOscillator(),g=c.createGain();o.type=type;o.frequency.value=frequency;g.gain.setValueAtTime(volume,c.currentTime);g.gain.exponentialRampToValueAtTime(.0001,c.currentTime+duration);o.connect(g).connect(c.destination);o.start();o.stop(c.currentTime+duration);this.nodes.push(o);
  }
  update(time,muted=false){
    if(this.gain)this.gain.gain.value=time<23.3&&!muted?.12:0;
    if(time>=21.8&&!this.hornPlayed){this.hornPlayed=true;if(!muted){this.tone(185,.55,.045,'sawtooth');this.tone(232,.55,.02,'sawtooth');}}
    if(time>=27&&!this.bellPlayed){this.bellPlayed=true;if(!muted){this.tone(522,3,.08);this.tone(1046,1.6,.025);}}
  }
  dispose(){for(const node of this.nodes){try{node.stop();node.disconnect();}catch{/* Already ended. */}}this.nodes=[];}
}
