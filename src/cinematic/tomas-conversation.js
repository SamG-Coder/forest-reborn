import {MathUtils,Vector3} from 'three';
import {applyArmFK} from '../game/arm-motion.js';
import {poseHand} from '../game/hand-poses.js';

/** Borrow the actual innkeeper, suppress his routine, and return him afterwards. */
export class TomasConversation {
  constructor(world, origin) {this.world=world;this.origin=origin;}
  start() {
    if(this.person)return;
    this.person=this.world.population.residents.find(p=>p.id==='innkeeper');
    if(!this.person)return;
    const p=this.person;
    this.saved={position:p.position.clone(),yaw:p.actor.root.rotation.y,hp:p.target.hp,visible:p.actor.root.visible};
    p.cinematic=true;p.target.hp=p.maxHp;p.actor.root.visible=true;
    p.position.copy(this.origin).add(new Vector3(-1.35,0,1.15));
    p.position.y=this.world.height(p.position.x,p.position.z);
    p.actor.root.rotation.y=Math.atan2(this.origin.x-p.position.x,this.origin.z-p.position.z);
  }
  update(dt,time,speaking) {
    const p=this.person;if(!p)return;
    p.actor.update(dt,{speed:0,armed:false,activity:'rest'});
    const b=p.actor.avatar.rig.bones;
    const lean=1-MathUtils.smoothstep(time,6,11);
    b.chest.rotation.x+=.14*lean;b.head.rotation.x=.14*lean+(speaking?Math.sin(time*3)*.035:0);
    if(speaking){
      const beat=.5+.5*Math.sin(time*2.2);
      applyArmFK(b,'R',{shoulder:.32+beat*.08,elbow:1.12,spread:.18,sweep:-.1,wrist:0});
      poseHand(p.actor.avatar.rig,'R','open');
    }
    p.actor.root.updateMatrixWorld(true);
  }
  finish() {
    const p=this.person;if(!p)return;
    p.cinematic=false;p.position.copy(this.saved.position);p.actor.root.rotation.y=this.saved.yaw;
    p.target.hp=this.saved.hp;p.actor.root.visible=this.saved.visible;p.pathGoal=null;
    p.actor.update(0,{speed:0,armed:false,activity:'rest'});this.person=null;
  }
}
