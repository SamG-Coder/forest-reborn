import * as THREE from 'three';
import {solveTwoBone,alignElbowHinge} from '../game/constraints.js';
import {poseHand} from '../game/hand-poses.js';
import {isWeapon,weaponAction} from '../game/weapon-catalog.js';
import {alignWeaponFamily} from '../game/weapon-motion.js';

export const RIDER_HIP_HEIGHT=.94;
export const RIDER_OFFSET=1.64-RIDER_HIP_HEIGHT;

/** Shared by the player and the baked cavalry palette. Feet stay in the
 * stirrups; sword attacks use one hand while the other holds the reins. */
export function applyRiderPose(avatar,state={}){
  const {root,rig}=avatar,b=rig.bones,armed=isWeapon(state.weapon);
  b.hips.position.y=RIDER_HIP_HEIGHT;b.hips.rotation.set(0,0,0);
  if(!armed)for(const name of ['spine','chest','neck','head'])b[name].rotation.set(name==='spine'?-.06:0,0,0);
  root.updateMatrixWorld(true);
  const world=(x,y,z)=>root.localToWorld(new THREE.Vector3(x,y,z)),orientation=root.getWorldQuaternion(new THREE.Quaternion());
  for(const [side,s]of [['L',1],['R',-1]]){
    solveTwoBone(b['thigh'+side],b['shin'+side],b['foot'+side],world(s*.43,.23,.10),world(s*.42,.70,.60),orientation);
    b['toe'+side].rotation.set(0,0,0);
    if(!armed||side==='L'&&!['spear','shield','bow'].includes(weaponAction(state.weapon).grip)){
      solveTwoBone(b['upperArm'+side],b['forearm'+side],b['hand'+side],world(s*.20,1.12,.33),world(s*.47,1.13,.13));
      alignElbowHinge(b['upperArm'+side],b['forearm'+side],b['hand'+side]);
      b['hand'+side].quaternion.identity();poseHand(rig,side,'grip');
    }
  }
  if(armed)alignWeaponFamily(avatar,{...state,mounted:true});
  for(const side of ['L','R'])alignElbowHinge(b['upperArm'+side],b['forearm'+side],b['hand'+side]);
  root.updateMatrixWorld(true);
}
