import * as THREE from 'three';

export const ANIMATIONS=['idle','walk','run','attack','bind'];
/** All clothing and hair inherit this pose through the same skeleton. */
export function poseRig(rig,mode,time){
 rig.reset();const b=rig.bones;
 if(mode==='bind')return;
 b.chest.rotation.x=Math.sin(time*1.8)*.012;b.head.rotation.y=Math.sin(time*.7)*.045;
 b.upperArmL.rotation.z=.07;b.upperArmR.rotation.z=-.09;b.forearmR.rotation.x=-.16;
 if(mode==='walk'||mode==='run'){
  const phase=time*(mode==='run'?10:6),amp=mode==='run'?.65:.38;
  b.hips.position.y+=Math.abs(Math.sin(phase))*.045;
  b.thighL.rotation.x=Math.sin(phase)*amp;b.thighR.rotation.x=-Math.sin(phase)*amp;
  b.shinL.rotation.x=Math.max(0,-Math.sin(phase))*.75;b.shinR.rotation.x=Math.max(0,Math.sin(phase))*.75;
  b.upperArmL.rotation.x=-Math.sin(phase)*amp*.75;b.upperArmR.rotation.x=Math.sin(phase)*amp*.55-.15;
  b.coatTailL.rotation.x=-.14+Math.sin(phase)*.18;b.coatTailR.rotation.x=-.14-Math.sin(phase)*.18;
 }else{b.coatTailL.rotation.x=Math.sin(time*2)*.025;b.coatTailR.rotation.x=Math.sin(time*2+.6)*.025;}
 if(mode==='attack'){
  const phase=(time%1.15)/1.15,swing=Math.sin(phase*Math.PI);
  b.chest.rotation.y=-.65*swing;b.upperArmR.rotation.x=-1.6*swing;b.upperArmR.rotation.z=-.65*swing;b.forearmR.rotation.x=-.8*swing;b.handR.rotation.z=-.6*swing;
  b.upperArmL.rotation.x=-.25*swing;b.thighL.rotation.x=-.12*swing;
 }
}
export function createAnimationClips(model){
 const clips=[];
 for(const [mode,duration] of [['idle',3.5],['walk',Math.PI/3],['run',Math.PI/5],['attack',1.15]]){
  const times=[],positions={},rotations={};for(const bone of model.rig.skeleton.bones){positions[bone.name]=[];rotations[bone.name]=[];}
  const frames=mode==='idle'?70:40;
  for(let frame=0;frame<=frames;frame++){
   const time=frame/frames*duration;times.push(time);poseRig(model.rig,mode,time);
   for(const bone of model.rig.skeleton.bones){positions[bone.name].push(...bone.position.toArray());rotations[bone.name].push(...bone.quaternion.toArray());}
  }
  const tracks=[];for(const bone of model.rig.skeleton.bones){tracks.push(new THREE.VectorKeyframeTrack(`${bone.name}.position`,times,positions[bone.name]),new THREE.QuaternionKeyframeTrack(`${bone.name}.quaternion`,times,rotations[bone.name]));}
  clips.push(new THREE.AnimationClip(mode,duration,tracks));
 }
 model.rig.reset();model.root.updateMatrixWorld(true);return clips;
}
