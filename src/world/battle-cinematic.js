import * as THREE from 'three';

/** A short in-world camera sequence. Audio is generated at runtime and stops
 * with the scene; there is no loading gap for a soundtrack asset. */
export class BattleCinematic {
  constructor({camera,scene,getAudio,onStart,onFinish,voices}){
    Object.assign(this,{camera,scene,getAudio,onStart,onFinish,voices});this.active=false;
    this.overlay=document.createElement('div');this.overlay.className='battle-cinematic';this.overlay.hidden=true;
    this.subtitle=document.createElement('p');this.overlay.append(this.subtitle);
    const skip=document.createElement('button');skip.textContent='Skip scene';skip.onclick=()=>this.finish();this.overlay.append(skip);document.body.append(this.overlay);
  }
  start(site,runtime){
    if(this.active)return;this.active=true;this.site=site;this.runtime=runtime;this.time=0;this.line=-1;
    this.saved={position:this.camera.position.clone(),quaternion:this.camera.quaternion.clone(),far:this.camera.far,fog:this.scene.fog?.clone()};
    runtime.paused=true;this.camera.far=1800;if(this.scene.fog){this.scene.fog.near=450;this.scene.fog.far=1400;}this.camera.updateProjectionMatrix();
    this.overlay.hidden=false;this.onStart?.();this.music();
  }
  music(){
    const ctx=this.getAudio?.();if(!ctx)return;
    this.gain=ctx.createGain();this.gain.gain.value=.08;this.gain.connect(ctx.gameAudio?.destination('music')??ctx.destination);this.notes=[];
    const start=ctx.currentTime+.05,notes=[146.83,174.61,220,196,146.83,174.61,261.63,220];
    for(let i=0;i<32;i++){
      const osc=ctx.createOscillator(),env=ctx.createGain(),t=start+i*.5;
      osc.type=i%4===0?'triangle':'sine';osc.frequency.value=notes[Math.floor(i/4)%notes.length]*(i%4===0?.5:1);
      env.gain.setValueAtTime(0,t);env.gain.linearRampToValueAtTime(i%4===0?.9:.35,t+.06);env.gain.exponentialRampToValueAtTime(.001,t+.48);
      osc.connect(env);env.connect(this.gain);osc.start(t);osc.stop(t+.5);this.notes.push(osc);
    }
  }
  update(dt){
    if(!this.active)return false;this.time+=dt;const t=this.time,s=this.site;
    const shots=[{from:[-190,92,220],to:[-125,65,155],look:[0,5,0]},{from:[-54,4,34],to:[-38,5,20],look:[25,3,-15]},{from:[30,10,-76],to:[14,7,-49],look:[-35,2,15]}];
    const index=Math.min(2,Math.floor(t/5.4)),p=THREE.MathUtils.smoothstep(t-index*5.4,0,5.4),shot=shots[index];
    const offset=new THREE.Vector3(...shot.from).lerp(new THREE.Vector3(...shot.to),p);
    const ground=this.runtime.height?.(s.x+offset.x,s.z+offset.z)??this.runtime.enemies[0]?.position.y??0;
    this.camera.position.set(s.x+offset.x,ground+offset.y,s.z+offset.z);
    this.camera.lookAt(s.x+shot.look[0],ground+shot.look[1],s.z+shot.look[2]);
    this.runtime.crowd.update(this.camera,this.runtime.simulation.time,dt);
    const ash=this.runtime.playerTeam===1;
    const lines=ash?['Highmere is forming across the low ground. Stay with your company.','The red banners are ours. If you lose the line, make your way back to them.','Watch the flanks. We need that crossing, but I want you back alive.']:['That is the Ash Company, across the low ground. More of them than the scouts counted.','Keep with your company. If the line breaks, fall back to the blue banners.','Watch the flanks — and come back alive.'];
    if(this.line!==index){this.line=index;this.subtitle.textContent=(ash?'Ash captain: ':'Elian: ')+lines[index];this.voices?.speak({id:ash?'ash-captain':'highmere-marshal',gender:'male'},lines[index],{channel:'cinematic',maxDelay:1000});}
    if(t>=16.2)this.finish();return true;
  }
  finish(){
    if(!this.active)return;this.active=false;this.runtime.paused=false;this.overlay.hidden=true;
    this.camera.position.copy(this.saved.position);this.camera.quaternion.copy(this.saved.quaternion);this.camera.far=this.saved.far;this.camera.updateProjectionMatrix();this.scene.fog=this.saved.fog;
    this.voices?.stop('cinematic');for(const note of this.notes??[])try{note.stop();}catch{}this.gain?.disconnect();this.onFinish?.();
  }
  dispose(){this.finish();this.overlay.remove();}
}
