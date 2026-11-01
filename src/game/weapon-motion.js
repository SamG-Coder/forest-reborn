import * as THREE from 'three';
import {solveTwoBone} from './constraints.js';
import {poseHand} from './hand-poses.js';
import {SWORD_GRIP,swordGripOrientation} from './weapon-sockets.js';
import {weaponAction} from './weapon-catalog.js';
import {alignBow} from './bow-motion.js';

export function sampleTwoHandCut(progress,combo=0){
  const p=THREE.MathUtils.clamp(progress,0,1),cut=THREE.MathUtils.smoothstep(p,.24,.56),weight=THREE.MathUtils.smoothstep(p,0,.20)*(1-THREE.MathUtils.smoothstep(p,.72,1));
  const grip=new THREE.Vector3(-.025,1.24,.30),blade=new THREE.Vector3(0,.76,.65).normalize();
  if(combo%2){
    const yaw=THREE.MathUtils.lerp(1.22,-1.35,cut);
    grip.lerp(new THREE.Vector3(THREE.MathUtils.lerp(-.045,.10,cut),1.22,.28),weight);
    blade.lerp(new THREE.Vector3(Math.sin(yaw),.12,Math.cos(yaw)).normalize(),weight).normalize();
  }else{
    const angle=THREE.MathUtils.lerp(-.28,2.10,cut);
    grip.lerp(new THREE.Vector3(-.025,THREE.MathUtils.lerp(1.57,1.08,cut),THREE.MathUtils.lerp(.21,.34,cut)),weight);
    blade.lerp(new THREE.Vector3(0,Math.cos(angle),Math.sin(angle)),weight).normalize();
  }
  return {grip,blade,weight};
}

export function twoHandCutFrame(progress,combo=0){
  const pose=sampleTwoHandCut(progress,combo),before=sampleTwoHandCut(progress-.002,combo),after=sampleTwoHandCut(progress+.002,combo);
  const velocity=after.grip.addScaledVector(after.blade,.95).sub(before.grip.addScaledVector(before.blade,.95));
  const edge=velocity.projectOnPlane(pose.blade);
  // Flat blade faces are perpendicular to the cutting plane. Its narrow edge
  // leads the motion throughout the contact part of both arcs.
  if(edge.lengthSq()<1e-8)edge.set(-1,0,0).projectOnPlane(pose.blade);
  edge.normalize();return {...pose,edge};
}

export function sampleMountedCut(progress,side=-1,combo=0){
  const p=THREE.MathUtils.clamp(progress,0,1),cut=THREE.MathUtils.smoothstep(p,.23,.60);
  const weight=THREE.MathUtils.smoothstep(p,0,.20)*(1-THREE.MathUtils.smoothstep(p,.72,1));
  const travel=combo%2?1-cut:cut,yaw=side*THREE.MathUtils.lerp(.30,2.15,travel);
  const grip=new THREE.Vector3(-.27,1.24,.28).lerp(new THREE.Vector3(side*.34,1.31-.16*cut,.34-.25*travel),weight);
  const blade=new THREE.Vector3(-.08,.75,.65).normalize().lerp(new THREE.Vector3(Math.sin(yaw),.14-.60*cut,Math.cos(yaw)).normalize(),weight).normalize();
  return {grip,blade,weight};
}

export function mountedCutFrame(progress,side=-1,combo=0){
  const pose=sampleMountedCut(progress,side,combo),before=sampleMountedCut(progress-.002,side,combo),after=sampleMountedCut(progress+.002,side,combo);
  const edge=after.grip.addScaledVector(after.blade,.95).sub(before.grip.addScaledVector(before.blade,.95)).projectOnPlane(pose.blade);
  if(edge.lengthSq()<1e-8)edge.set(-1,0,0).projectOnPlane(pose.blade);
  return {...pose,edge:edge.normalize()};
}

/** Authored polearm/two-hand paths. The support hand is constrained to a point
 * on the same weapon frame after the dominant arm has been solved. */
export function alignWeaponFamily(avatar,state){
  const spec=weaponAction(state.weapon),family=spec.grip,{root,rig}=avatar,b=rig.bones;
  if(family==='bow'){alignBow(avatar,state);return;}
  if(!['spear','two-hand','shield'].includes(family)&&!state.mounted)return;
  const p=state.action?.progress??0,active=Boolean(state.action),t=THREE.MathUtils.smoothstep(p,.25,.52),recover=1-THREE.MathUtils.smoothstep(p,.66,1),weight=active?THREE.MathUtils.smoothstep(p,0,.20)*recover:0;
  root.updateMatrixWorld(true);const rootQ=root.getWorldQuaternion(new THREE.Quaternion());
  if(family==='shield'){
    const target=root.localToWorld(new THREE.Vector3(state.block?.05:.24,state.block?1.34:1.12,state.block?.43:.28));
    const orientation=rootQ.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),-Math.PI/2));
    solveTwoBone(b.upperArmL,b.forearmL,b.handL,target,root.localToWorld(new THREE.Vector3(.36,1.03,.08)),orientation);poseHand(rig,'L','grip',1,0);if(!state.mounted)return;
  }
  let wrist,blade,cutEdge;
  if(state.mounted&&family!=='spear'){
    const frame=mountedCutFrame(p,state.action?.aimSide??-1,state.action?.combo??0);
    wrist=frame.grip;blade=frame.blade;if(active)cutEdge=frame.edge;
  }else if(family==='spear'){
    const extension=THREE.MathUtils.smoothstep(p,.23,.46)*(1-THREE.MathUtils.smoothstep(p,.58,.9));
    wrist=new THREE.Vector3(-.13,1.22,state.mounted?.02+extension*.14:.12+extension*.04);blade=new THREE.Vector3(.38,state.mounted?-.24:.10*(1-weight),1).normalize();
  }else{
    const frame=twoHandCutFrame(p,state.action?.combo??0);blade=frame.blade;wrist=frame.grip;
    if(active){cutEdge=frame.edge;if(cutEdge.x>0)cutEdge.negate();}
    if(state.mounted&&active){const side=state.action.aimSide??-1;blade.x+=side*.85*frame.weight;blade.y-=.35*frame.weight;blade.normalize();cutEdge.projectOnPlane(blade).normalize();}
  }
  if(state.block){wrist.set(-.1,1.42,.30);blade.set(.8,.2,.4).normalize();}
  const edge=cutEdge??new THREE.Vector3(-1,0,0).projectOnPlane(blade).normalize(),normal=edge.clone().cross(blade),weaponQ=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(edge,blade,normal));
  const socket=root.getObjectByName('socket.rightPalmGrip'),handQ=rootQ.clone().multiply(weaponQ).multiply((socket?.quaternion??swordGripOrientation()).clone().invert());
  const rightOffset=new THREE.Vector3(...SWORD_GRIP.position).applyQuaternion(handQ).multiplyScalar(root.getWorldScale(new THREE.Vector3()).x);
  const rightWrist=root.localToWorld(wrist).sub(rightOffset);
  solveTwoBone(b.upperArmR,b.forearmR,b.handR,rightWrist,root.localToWorld(new THREE.Vector3(-.39,1.02,.08)),handQ);root.updateMatrixWorld(true);
  const sword=socket?.children[0];
  if(sword&&(family==='spear'||family==='two-hand'&&!state.mounted)){
    const grip=sword.localToWorld(new THREE.Vector3(0,family==='spear'?.24:-.22,0));
    const leftQ=sword.getWorldQuaternion(new THREE.Quaternion()).multiply(swordGripOrientation().invert()).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),Math.PI));
    const offset=new THREE.Vector3(-SWORD_GRIP.position[0],SWORD_GRIP.position[1],SWORD_GRIP.position[2]).applyQuaternion(leftQ).multiplyScalar(root.getWorldScale(new THREE.Vector3()).x);
    solveTwoBone(b.upperArmL,b.forearmL,b.handL,grip.sub(offset),root.localToWorld(new THREE.Vector3(.35,1.08,.06)),leftQ);
  }
  poseHand(rig,'L','grip',1,0);poseHand(rig,'R','grip',1,0);
}
