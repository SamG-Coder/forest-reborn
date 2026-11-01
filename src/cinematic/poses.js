import * as THREE from 'three';
import {solveTwoBone} from '../game/constraints.js';
import {poseHand,alignPunchWrist} from '../game/hand-poses.js';
import {posePhoneHand} from './phone-grip.js';

const smooth=(t,a,b)=>THREE.MathUtils.smoothstep(t,a,b);
function handAt(avatar,side,point,hint,orientation=null) {
  avatar.root.updateMatrixWorld(true);
  const toWorld=p=>avatar.root.localToWorld(new THREE.Vector3(...p));
  const b=avatar.rig.bones,q=orientation?avatar.root.getWorldQuaternion(new THREE.Quaternion()).multiply(orientation):null;
  solveTwoBone(b[`upperArm${side}`],b[`forearm${side}`],b[`hand${side}`],toWorld(point),toWorld(hint),q);
}

export function phonePose(avatar,time,reaction=0) {
  const b=avatar.rig.bones;
  b.head.rotation.x=.18;b.neck.rotation.x=.035;
  handAt(avatar,'R',[-.12-reaction*.1,1.24-reaction*.18,.40-reaction*.13],[-.42,1.03,.15]);
  const screenDirection=new THREE.Vector3(0,.3,-1).applyQuaternion(avatar.root.getWorldQuaternion(new THREE.Quaternion()));
  alignPunchWrist(b,'R',screenDirection,1);
  posePhoneHand(avatar.rig);
  avatar.root.updateMatrixWorld(true);
}

export function evadeCarPose(avatar,{notice,flinch},baseHip) {
  const b=avatar.rig.bones;
  b.head.rotation.x=THREE.MathUtils.lerp(.18,-.06,notice);b.head.rotation.y=-.92*notice;
  b.chest.rotation.z=-.17*flinch;b.chest.rotation.y=-.12*notice;
  b.hips.position.y=baseHip-.04*flinch;
  if(flinch>0){
    const hand=new THREE.Vector3(.25,1.03,.09).lerp(new THREE.Vector3(-.12,1.48,.32),flinch);
    handAt(avatar,'L',hand.toArray(),[.43,1.25,.10]);poseHand(avatar.rig,'L','open');
  }
  avatar.root.updateMatrixWorld(true);
}

/** Seated wake-up, head scratch, then rise. Each pose is sampled, never accumulated. */
export function wakePose(avatar,time,baseHip) {
  const b=avatar.rig.bones,stand=smooth(time,7,11),seated=1-stand;
  b.hips.position.y=baseHip-.69*seated;
  b.spine.rotation.x=.12*seated;b.chest.rotation.x=.09*seated;
  for(const [side,sign] of [['L',1],['R',-1]]){
    avatar.root.updateMatrixWorld(true);
    const target=avatar.root.localToWorld(new THREE.Vector3(sign*.12,.13,.48*seated));
    const hint=avatar.root.localToWorld(new THREE.Vector3(sign*.21,.58,.8));
    solveTwoBone(b[`thigh${side}`],b[`shin${side}`],b[`foot${side}`],target,hint,avatar.root.getWorldQuaternion(new THREE.Quaternion()));
  }
  const scratch=smooth(time,.7,1.6)*(1-smooth(time,5.5,6.6));
  b.head.rotation.set(.10*seated,-.2+Math.sin(time*.55)*.25,.08*scratch);
  avatar.root.updateMatrixWorld(true);
  if(scratch>0){
    const head=avatar.root.worldToLocal(b.head.getWorldPosition(new THREE.Vector3()));
    const rest=new THREE.Vector3(-.27,.75-.4*seated,.16);
    const target=head.clone().add(new THREE.Vector3(-.13,.12+Math.sin(time*13)*.014,.016));rest.lerp(target,scratch);
    handAt(avatar,'R',rest.toArray(),[-.48,head.y-.06,.1]);
    poseHand(avatar.rig,'R','open',1,.9);
  }
  if(seated>.05)handAt(avatar,'L',[.30,.19+.6*stand,.02],[.48,.48+.5*stand,.05]);
  avatar.root.updateMatrixWorld(true);
}
