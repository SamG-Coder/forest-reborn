import * as THREE from 'three';
import {solveTwoBone} from './constraints.js';
const GRIP_CURLS=Object.freeze({index:[.24,.65,1.135],middle:[.55,1.625,.635],ring:[1.075,1.56,.79],little:[1.415,1.08,.845]});

/** Distinct open, cylindrical grip and compact fist poses on the shared hand rig. */
export function poseHand(rig,side,mode,weight=1,relaxation=0){
  const s=side==='L'?1:-1,bones=rig.bones;
  const curls=mode==='fist'?[1.45,1.65,.80]:mode==='grip'?[1.08,1.30,.65]:[.10+relaxation*.25,.16+relaxation*.35,.10+relaxation*.20];
  for(const [finger,extra]of [['index',-.08],['middle',0],['ring',.08],['little',.16]])for(let joint=1;joint<=3;joint++){
    // Individual phalange angles fit the actual hilt cylinder. Equal curls
    // either leave the index open or drive the shorter fingers through it.
    const curl=mode==='grip'?GRIP_CURLS[finger][joint-1]:curls[joint-1]+(mode==='open'?0:extra);
    const q=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),-s*curl);
    if(mode==='grip'&&joint===1){
      const gather={index:.25,middle:.08,ring:-.08,little:-.25}[finger];
      q.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),s*gather));
    }
    bones[`${finger}${joint}${side}`].quaternion.slerp(q,weight);
  }
  // Thumb opposition across the OUTSIDE of the curled fingers, not inside the fist.
  if(mode!=='open'){
    const thumb=bones[`thumb2${side}`];
    let tip=thumb.getObjectByName(`thumbTip${side}`);
    if(!tip){tip=new THREE.Object3D();tip.name=`thumbTip${side}`;const segment=rig.segments.find(b=>b.name===thumb.name);tip.position.copy(segment.end).sub(segment.start);thumb.add(tip);}
    const hand=bones[`hand${side}`];hand.updateWorldMatrix(true,true);
    const target=hand.localToWorld(mode==='fist'?new THREE.Vector3(s*.078,-.039,.014):new THREE.Vector3(s*.083,-.049,.027));
    const hint=hand.localToWorld(new THREE.Vector3(s*.07,-.065,.075));
    const first=bones[`thumb1${side}`],oldA=first.quaternion.clone(),oldB=thumb.quaternion.clone();
    solveTwoBone(first,thumb,tip,target,hint);
    first.quaternion.copy(oldA.slerp(first.quaternion.clone(),weight));thumb.quaternion.copy(oldB.slerp(thumb.quaternion.clone(),weight));
  }else for(let joint=1;joint<=2;joint++)bones[`thumb${joint}${side}`].quaternion.slerp(new THREE.Quaternion().setFromEuler(new THREE.Euler(0,s*.08,-s*.1)),weight);
}

/** Pronation rotates the forearm around its own axis; it never bends the wrist. */
export function alignPunchWrist(bones,side,palmDown,weight=1){
  const fore=bones[`forearm${side}`],hand=bones[`hand${side}`];hand.quaternion.identity();
  fore.updateWorldMatrix(true,true);
  const axis=hand.getWorldPosition(new THREE.Vector3()).sub(fore.getWorldPosition(new THREE.Vector3())).normalize();
  const current=new THREE.Vector3(0,-1,0).applyQuaternion(hand.getWorldQuaternion(new THREE.Quaternion()));
  current.addScaledVector(axis,-current.dot(axis)).normalize();
  const desired=palmDown.clone().addScaledVector(axis,-palmDown.dot(axis));
  if(desired.lengthSq()<1e-8)return;desired.normalize();
  const angle=Math.atan2(axis.dot(current.clone().cross(desired)),current.dot(desired));
  fore.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(hand.position.clone().normalize(),angle*weight));
  hand.quaternion.identity();fore.updateWorldMatrix(false,true);
}
