import * as THREE from 'three';
import {solveTwoBone} from './constraints.js';
import {poseHand} from './hand-poses.js';
import {swordGripOrientation} from './weapon-sockets.js';
import {BOW_GRIP,NOCK_GRIP} from './bow-model.js';

export function bowPose(progress=null){
  const active=progress!==null,p=progress??0,raise=active?THREE.MathUtils.smoothstep(p,0,.18)*(1-THREE.MathUtils.smoothstep(p,.85,1)):0;
  const draw=THREE.MathUtils.smoothstep(p,.15,.52)*(1-THREE.MathUtils.smoothstep(p,.64,.70));
  return {grip:new THREE.Vector3(.18,1.28,.30).lerp(new THREE.Vector3(.08,1.50,.78),raise),nock:new THREE.Vector3(.13,1.28,.20).lerp(new THREE.Vector3(-.035,1.52,.63-draw*.51),raise),draw};
}
export function alignBow(avatar,state){
  const {root,rig}=avatar,b=rig.bones,pose=bowPose(state.action?.progress??null),q=root.getWorldQuaternion(new THREE.Quaternion()),scale=root.getWorldScale(new THREE.Vector3()).x;
  if(root.userData.nockedArrow)root.userData.nockedArrow.userData.shown.value=state.action&&state.action.progress>.12&&state.action.progress<.64?1:0;
  const orientations={L:q.clone().multiply(swordGripOrientation().invert()),R:q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),Math.PI/2))};
  for(const [side,point,offset]of [['L',pose.grip,BOW_GRIP],['R',pose.nock,NOCK_GRIP]]){
    const orientation=orientations[side],target=root.localToWorld(point).sub(new THREE.Vector3(...offset).applyQuaternion(orientation).multiplyScalar(scale));
    const hint=root.localToWorld(new THREE.Vector3(side==='L'?.35:-.45,side==='L'?1.40:1.53,side==='L'?.48:-.30));
    solveTwoBone(b['upperArm'+side],b['forearm'+side],b['hand'+side],target,hint,orientation);
    poseHand(rig,side,side==='L'?'grip':'open',1,.4);
    if(side==='R')for(const finger of ['index','middle','ring']){b[finger+'2R'].rotation.z=1.0;b[finger+'3R'].rotation.z=.5;}
    root.updateMatrixWorld(true);
  }
}
