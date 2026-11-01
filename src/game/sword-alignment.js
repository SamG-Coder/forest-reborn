import * as THREE from 'three';
import {solveWeaponArm} from './constraints.js';
import {swordGripOrientation} from './weapon-sockets.js';
import {sampleSwordCut} from './sword-motion.js';
const {smoothstep,lerp}=THREE.MathUtils;
const defaultGrip=swordGripOrientation();
const readyBladeFrame=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),-.95)
  .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),Math.PI/2));

/** Cutting edge follows the arc; thrusting point follows the forward line.
 * Build the weapon frame first, then pose the arm around the neutral wrist. */
export function alignSwordAction(avatar,action){
  const {root,rig}=avatar,b=rig.bones,p=action.progress;
  const cut=sampleSwordCut(p,action.combo,action.height,action.power??0);
  const weight=cut.weight;
  root.updateMatrixWorld(true);
  const rootQ=root.getWorldQuaternion(new THREE.Quaternion());
  let blade,edge,wrist;
  if(action.style==='thrust'){
    const extension=smoothstep(p,.28,.46)*(1-smoothstep(p,.56,.86));
    // Turn the cutting edge down for the thrust. With an edge-sideways frame,
    // the diagonal grip forced the forearm sideways and flared the elbow out.
    blade=new THREE.Vector3(0,0,1);edge=new THREE.Vector3(0,-1,0);
    wrist=root.localToWorld(new THREE.Vector3(-.14,THREE.MathUtils.clamp(action.height,1.08,1.43),lerp(.20,.64,extension)));
  }else{
    blade=cut.blade;edge=cut.edge;wrist=root.localToWorld(cut.wrist);
  }
  const normal=edge.clone().cross(blade).normalize();
  const weaponQ=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(edge,blade,normal));
  const ready=readyFrame(avatar,0);
  weaponQ.copy(ready.orientation.clone().slerp(weaponQ,weight));
  wrist.copy(ready.wrist.lerp(wrist,weight));
  const socket=root.getObjectByName('socket.rightPalmGrip');
  const handQ=rootQ.clone().multiply(weaponQ).multiply((socket?.quaternion??defaultGrip).clone().invert());
  // A small, explicit extension for thrusting; the elbow must not compensate
  // for the entire grip angle. Never use unconstrained wrist aiming.
  const wristQ=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),action.style==='thrust'?-.20*weight:0);
  const cutNormal=normal.clone().applyQuaternion(rootQ);
  const planeX=-.30;
  const cutPlane=action.style==='thrust'?null:{normal:cutNormal,offset:root.localToWorld(new THREE.Vector3(planeX,cut.planeHeight,0)).dot(cutNormal),weight};
  solveWeaponArm(b.upperArmR,b.forearmR,b.handR,wrist,handQ.multiply(wristQ.clone().invert()),1,elbowClearance(root),cutPlane);
  b.handR.quaternion.copy(wristQ);
}

function readyFrame(avatar,guard){
  const {root,rig}=avatar,b=rig.bones;
  const q=(x,y,z)=>new THREE.Quaternion().setFromEuler(new THREE.Euler(x,y,z));
  // Author the arm first: dropped upper arm, relaxed elbow, forward forearm.
  // Derive the sword frame from that palm, rather than solving a desired blade
  // angle by pulling the hand up to the face.
  const upper=b.upperArmR.parent.getWorldQuaternion(new THREE.Quaternion())
    .multiply(q(0,lerp(.22,.12,guard),0))
    .multiply(q(-lerp(.30,.60,guard),0,0))
    .multiply(q(0,0,Math.PI/2-.23));
  const fore=upper.clone().multiply(q(0,lerp(1.35,1.50,guard),0));
  const wrist=b.upperArmR.getWorldPosition(new THREE.Vector3())
    .add(b.forearmR.position.clone().applyQuaternion(upper))
    .add(b.handR.position.clone().applyQuaternion(fore));
  wrist.add(new THREE.Vector3(0,.045,0).applyQuaternion(root.getWorldQuaternion(new THREE.Quaternion())));
  const socket=root.getObjectByName('socket.rightPalmGrip');
  const orientation=root.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(fore)
    .multiply(readyBladeFrame);
  return {orientation,wrist};
}

/** One common ready frame is both the start and recovery destination. Keeping
 * the hilt ahead of the torso avoids the old FK recovery through the hips. */
export function alignSwordReady(avatar,block=false){
  const {root,rig}=avatar,b=rig.bones;root.updateMatrixWorld(true);
  const ready=readyFrame(avatar,Number(block)),socket=root.getObjectByName('socket.rightPalmGrip');
  const orientation=root.getWorldQuaternion(new THREE.Quaternion()).multiply(ready.orientation)
    .multiply((socket?.quaternion??defaultGrip).clone().invert());
  solveWeaponArm(b.upperArmR,b.forearmR,b.handR,ready.wrist,orientation,1,elbowClearance(root));
}

function elbowClearance(root){
  return {outward:new THREE.Vector3(-1,0,0).applyQuaternion(root.getWorldQuaternion(new THREE.Quaternion())),
    point:root.localToWorld(new THREE.Vector3(-.275,1.2,0))};
}
