import {Vector3} from 'three';
import {EFFECTS,synthesizeEffect} from './effects.js';

export const AUDIO_DEFAULTS=Object.freeze({master:.8,voices:1,effects:.72,music:.55,ambience:.55});
const SETTINGS_KEY='forest-reborn-audio-v1';
export function rangeFade(distance,range){return Math.max(0,Math.min(1,(range-distance)/(range*.25)));}
const at=(position)=>typeof position==='function'?position():position;
const set3=(node,prefix,p,time)=>{for(const axis of ['X','Y','Z'])node[prefix+axis]?.setTargetAtTime(p[axis.toLowerCase()],time,.025);};

/** One listener, shared category buses, bounded one-shots, no per-frame nodes. */
export class GameAudio {
  constructor(getContext,storage){
    this.getContext=getContext;this.storage=storage;this.settings={...AUDIO_DEFAULTS};
    try{const saved=JSON.parse(storage?.getItem(SETTINGS_KEY));for(const key in this.settings)if(Number.isFinite(saved?.[key]))this.settings[key]=Math.max(0,Math.min(1,saved[key]));}catch{}
    this.spatial=new Set();this.playing=new Set();this.buffers=new Map();this.cooldowns=new Map();this.serial=0;this.position=new Vector3();this.forward=new Vector3(0,0,-1);this.up=new Vector3(0,1,0);this.muted=false;this.paused=false;
    this.metrics={played:0,culled:0,limited:0};
  }
  ensure(){
    const context=this.getContext();if(!context)return null;if(this.context===context)return context;this.context=context;
    this.master=context.createGain();this.limiter=context.createDynamicsCompressor();Object.assign(this.limiter.threshold,{value:-9});this.limiter.knee.value=14;this.limiter.ratio.value=6;this.limiter.attack.value=.003;this.limiter.release.value=.18;
    this.buses={};for(const key of ['voices','effects','music','ambience']){const bus=context.createGain();bus.gain.value=this.settings[key];bus.connect(this.master);this.buses[key]=bus;}
    this.master.gain.value=this.muted||this.paused?0:this.settings.master;this.master.connect(this.limiter);this.limiter.connect(context.destination);
    // Cinematics share the same mixer even when they own their source nodes.
    context.gameAudio=this;return context;
  }
  destination(bus){return this.ensure()?this.buses[bus]:null;}
  setVolume(key,value){if(!(key in AUDIO_DEFAULTS))return;this.settings[key]=Math.max(0,Math.min(1,Number(value)||0));try{this.storage?.setItem(SETTINGS_KEY,JSON.stringify(this.settings));}catch{}this.applyLevels();}
  setMuted(value){this.muted=value;this.applyLevels();}
  setPaused(value){this.paused=value;this.applyLevels();}
  applyLevels(duck=this.duck??false){
    if(!this.context)return;const now=this.context.currentTime;this.master.gain.setTargetAtTime(this.muted||this.paused?0:this.settings.master,now,.03);
    for(const [key,bus]of Object.entries(this.buses))bus.gain.setTargetAtTime(this.settings[key]*(duck?(key==='music'?.3:key==='effects'?.6:key==='ambience'?.5:1):1),now,.14);
  }
  update(position,camera,speaking=false){
    this.position.copy(position);this.position.y+=1.5;
    if(!this.ensure())return;const now=this.context.currentTime;
    if(camera){camera.getWorldDirection(this.forward);this.up.set(0,1,0).applyQuaternion(camera.quaternion);}
    const listener=this.context.listener;set3(listener,'position',this.position,now);set3(listener,'forward',this.forward,now);set3(listener,'up',this.up,now);
    if(this.duck!==speaking){this.duck=speaking;this.applyLevels(speaking);}
    for(const source of this.spatial)this.updateSource(source);
    if(this.cooldowns.size>512)for(const [key,time]of this.cooldowns)if(time<now)this.cooldowns.delete(key);
  }
  updateSource(source){
    const point=at(source.position);if(!point)return;const now=this.context.currentTime,distance=this.position.distanceTo(point);
    set3(source.panner,'position',point,now);
    source.fade.gain.setTargetAtTime(rangeFade(distance,source.range),now,.035);
    source.filter.frequency.setTargetAtTime(Math.max(1800,18000/(1+distance*.06)),now,.05);
  }
  spatialInput(position,{bus='effects',range=40}={}){
    const context=this.ensure();if(!context)return null;
    const panner=context.createPanner(),filter=context.createBiquadFilter(),fade=context.createGain();
    panner.panningModel='HRTF';panner.distanceModel='inverse';panner.refDistance=3;panner.rolloffFactor=1;panner.maxDistance=range;
    filter.type='lowpass';filter.Q.value=.3;panner.connect(filter);filter.connect(fade);fade.connect(this.buses[bus]);
    const source={position,range,panner,filter,fade,input:panner,dispose:()=>{panner.disconnect();filter.disconnect();fade.disconnect();this.spatial.delete(source);}};
    const point=at(position);if(point){for(const a of ['X','Y','Z'])panner['position'+a].value=point[a.toLowerCase()];fade.gain.value=rangeFade(this.position.distanceTo(point),range);}
    this.spatial.add(source);this.updateSource(source);return source;
  }
  play(kind,position,{id='',volume=1,priority=false}={}){
    const spec=EFFECTS[kind],context=this.ensure();if(!spec||!context||context.state!=='running'||this.muted||this.paused)return false;
    const point=at(position);if(!point||this.position.distanceTo(point)>=spec.range){this.metrics.culled++;return false;}
    const key=id?kind+':'+id:`${kind}:${Math.floor(point.x/4)}:${Math.floor(point.z/4)}`;
    if((this.cooldowns.get(key)??0)>context.currentTime||this.playing.size>=(priority?32:24)){this.metrics.limited++;return false;}
    this.cooldowns.set(key,context.currentTime+(id?.04:.09));
    const variant=this.serial++%3,cacheKey=kind+variant;
    if(!this.buffers.has(cacheKey)){const pcm=synthesizeEffect(kind,variant),buffer=context.createBuffer(1,pcm.length,22050);buffer.copyToChannel(pcm,0);this.buffers.set(cacheKey,buffer);}
    const source=context.createBufferSource(),gain=context.createGain(),spatial=this.spatialInput(position,{range:spec.range});
    source.buffer=this.buffers.get(cacheKey);source.playbackRate.value=.97+(variant*.03);gain.gain.value=spec.gain*volume;source.connect(gain);gain.connect(spatial.input);
    this.playing.add(source);source.onended=()=>{source.disconnect();gain.disconnect();spatial.dispose();this.playing.delete(source);};source.start();this.metrics.played++;return true;
  }
  dispose(){for(const source of this.playing)try{source.stop();}catch{}for(const source of this.spatial)source.dispose();this.playing.clear();this.master?.disconnect();this.limiter?.disconnect();for(const bus of Object.values(this.buses??{}))bus.disconnect();}
}
