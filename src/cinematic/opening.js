import * as THREE from 'three';
import {createStreet,createPhone} from './street.js';
import {phonePose,wakePose,evadeCarPose} from './poses.js';
import {avoidanceAt} from './approach-motion.js';
import {OpeningAudio} from './audio.js';
import {openingTrack,openingCaption,OPENING_LINES,OPENING_DURATION,WAKE_TIME,WAKE_POSITION} from './opening-script.js';
import {TomasConversation} from './tomas-conversation.js';
import './opening.css';
import {frameAttachment} from './shot-track.js';

export class ReincarnationOpening {
  static async create(options){return new ReincarnationOpening({...options,street:await createStreet(options.renderer)});}
  constructor({avatar,animator,wardrobe,camera,renderer,world,scene,onWake,onComplete,name,street,voices,playerVoice}){
    Object.assign(this,{avatar,animator,wardrobe,camera,renderer,world,scene,onWake,onComplete,name,voices,playerVoice});
    this.street=street;this.phone=createPhone(avatar.rig.bones.handR);this.time=0;this.active=false;this.woken=false;
    this.position=new THREE.Vector3(...WAKE_POSITION);this.position.y=world.height(this.position.x,this.position.z);
    this.conversation=new TomasConversation(world,this.position);
    this.overlay=document.createElement('section');this.overlay.className='opening-overlay';this.overlay.hidden=true;this.overlay.setAttribute('aria-label','Story opening');
    this.overlay.innerHTML='<div class="cinema-bar top"></div><div class="cinema-bar bottom"></div><div class="opening-fade"></div><div class="opening-chapter"><span>PROLOGUE</span><h1>The last bus</h1></div><div class="opening-subtitle" aria-live="polite"><b></b><p></p></div><div class="phone-message" hidden><small>MINA · NOW</small><p>You off yet?</p><span>On my way.</span><hr><small>TRANSIT · SERVICE UPDATE</small><p>Last bus cancelled.</p></div><div class="opening-controls"><button id="pause-opening">Pause</button><button id="skip-opening">Skip opening →</button></div>';
    document.body.append(this.overlay);
    this.fade=this.overlay.querySelector('.opening-fade');this.subtitle=this.overlay.querySelector('.opening-subtitle');this.chapter=this.overlay.querySelector('.opening-chapter');
    this.overlay.querySelector('#skip-opening').onclick=()=>this.finish();
    this.overlay.querySelector('#pause-opening').onclick=()=>{this.paused=!this.paused;this.overlay.querySelector('#pause-opening').textContent=this.paused?'Resume':'Pause';};
  }
  start(audio){
    this.active=true;this.overlay.hidden=false;this.time=0;this.woken=false;this.paused=false;
    this.spoken=new Set();this.prepared=new Set();this.voices?.setPaused(false);this.voices?.warm();
    this.street.scene.add(this.avatar.root);this.audio=new OpeningAudio(audio);this.audio.start();
  }
  wake(){if(this.woken)return;this.woken=true;this.phone.group.visible=false;this.scene.add(this.avatar.root);this.onWake();this.conversation.start();}
  update(dt,muted=false){
    if(!this.active)return;
    if(!this.paused){
      const line=openingCaption(this.time,this.name());
      let next=Math.min(OPENING_DURATION,this.time+dt);
      // Camera beats are minimum lengths. A line owns its shot until its audio
      // ends, including time spent generating on a slower machine.
      if(!muted&&line?.person&&this.voices?.busy('cinematic')&&next>=line.end)next=line.end-.001;
      this.time=next;
    }
    const t=this.time;this.audio?.update(t,muted||this.paused);
    this.voices?.setPaused(this.paused);
    if(!muted)for(const line of OPENING_LINES){
      const person=line.person==='player'?(this.playerVoice?.()??{id:'player'}):{id:'innkeeper'};
      if(t>=line.start-12&&t<line.end&&!this.prepared.has(line.id)){this.prepared.add(line.id);this.voices?.prepare(person,line.text);}
      if(t>=line.start&&t<line.end&&!this.spoken.has(line.id)){this.spoken.add(line.id);this.voices?.speak(person,line.text,{channel:'cinematic',maxDelay:30000});}
    }
    if(t>=WAKE_TIME)this.wake();
    const shot=openingTrack.sample(t);this.shot=shot.id;
    if(!this.woken){
      const cross=THREE.MathUtils.clamp((t-17)/4,0,1),turn=THREE.MathUtils.smoothstep(t,16.7,17.3);
      const avoidance=avoidanceAt(t);
      this.avatar.root.position.set(6.8-cross*6.2+avoidance.step*.68,.12*(1-cross),14.1-Math.min(t,17)*.8-cross*1.2+avoidance.step*.14);
      this.avatar.root.rotation.y=Math.PI+turn*(Math.atan2(6.2,1.2));
      const steppingBack=t>21.75&&t<22.6;
      this.animator.update(this.paused?0:dt,{speed:t<17?.8:t<21?1.5:steppingBack?1.2:0,travelAngle:steppingBack?Math.PI:0,weapon:'unarmed'});
      phonePose(this.avatar,t,avoidance.flinch);if(avoidance.notice>0)evadeCarPose(this.avatar,avoidance,this.animator.baseHip);
      this.phone.group.visible=t<23.3;this.street.update(t);
      openingTrack.apply(this.camera,t);
      if(shot.id==='phone')frameAttachment(this.camera,this.phone.group,{position:[.32,.40,.30],target:[0,.02,0],fov:36});
    }else{
      this.avatar.root.position.copy(this.position);this.avatar.root.rotation.y=-.865*THREE.MathUtils.smoothstep(t,34,38);
      this.animator.update(this.paused?0:dt,{speed:0,weapon:'unarmed'});wakePose(this.avatar,t-WAKE_TIME,this.animator.baseHip);
      this.world.update(t,this.position,this.paused?0:dt);openingTrack.apply(this.camera,t,this.position);
      this.conversation.update(this.paused?0:dt,t-WAKE_TIME,openingCaption(t,this.name())?.person==='innkeeper');
    }
    this.wardrobe.update(this.paused?0:dt);
    const caption=openingCaption(t,this.name());
    this.subtitle.hidden=!caption;
    if(caption){this.subtitle.querySelector('b').textContent=caption.speaker;this.subtitle.querySelector('p').textContent=caption.text;}
    this.chapter.hidden=!(t<4.7||t>=68&&t<71.3);
    this.chapter.querySelector('span').textContent=t<10?'PROLOGUE · 01':'A DIFFERENT MORNING';this.chapter.querySelector('h1').textContent=t<10?'The last bus':'Mosswake';
    this.overlay.querySelector('.phone-message').hidden=!(t>=12&&t<17);
    this.fade.style.opacity=t<1?1-t:t>=23.3&&t<27?1:t>=27&&t<29?1-(t-27)/2:0;
    this.renderer.render(this.woken?this.scene:this.street.scene,this.camera);
    if(t>=OPENING_DURATION)this.finish();
  }
  finish(){
    if(!this.active)return;
    this.wake();this.active=false;this.overlay.hidden=true;this.audio?.dispose();this.phone.group.visible=false;
    this.conversation.finish();this.voices?.stop('cinematic');this.voices?.setPaused(false);
    this.avatar.rig.bones.hips.position.y=this.animator.baseHip;this.animator.footContacts={L:null,R:null};
    this.onComplete(this.position.clone());
  }
  dispose(){this.conversation.finish();this.voices?.stop('cinematic');this.audio?.dispose();this.phone.dispose();this.street.dispose();this.overlay.remove();}
}
