import * as THREE from 'three';

export const MALE_RIG_ID='humanoid-male-v1';
/** Rest coordinates are model-space metres. +Y is up, +Z is forward. */
export function createMaleRig(root){
 const bones={},rest={},ordered=[];
 function add(name,parent,world){
  const bone=new THREE.Bone();bone.name=name;const origin=parent?rest[parent]:[0,0,0];
  bone.position.set(...world.map((v,i)=>v-origin[i]));(parent?bones[parent]:root).add(bone);
  bones[name]=bone;rest[name]=world;ordered.push(bone);
 }
 add('hips',null,[0,1.43,0]);add('spine','hips',[0,1.66,0]);add('chest','spine',[0,2.04,0]);add('neck','chest',[0,2.31,0]);add('head','neck',[0,2.47,0]);
 for(const [side,sign] of [['L',1],['R',-1]]){
  add(`upperArm${side}`,'chest',[sign*.42,2.17,0]);add(`forearm${side}`,`upperArm${side}`,[sign*.51,1.80,0]);add(`hand${side}`,`forearm${side}`,[sign*.55,1.45,.025]);
  add(`thigh${side}`,'hips',[sign*.18,1.40,0]);add(`shin${side}`,`thigh${side}`,[sign*.18,.79,.015]);add(`foot${side}`,`shin${side}`,[sign*.18,.19,.02]);
  add(`coatTail${side}`,'hips',[sign*.22,1.46,-.09]);
 }
 root.updateMatrixWorld(true);const skeleton=new THREE.Skeleton(ordered);skeleton.calculateInverses();
 const indices=Object.fromEntries(ordered.map((bone,index)=>[bone.name,index]));
 const bindPositions=Object.fromEntries(ordered.map(bone=>[bone.name,bone.position.clone()]));
 const reset=()=>{for(const bone of ordered){bone.rotation.set(0,0,0);bone.position.copy(bindPositions[bone.name]);}};
 return {id:MALE_RIG_ID,bones,rest,skeleton,indices,bindPositions,reset,sockets:{head:bones.head,rightHand:bones.handR,leftHand:bones.handL,waist:bones.hips}};
}

/** Blend between the bones above and below a horizontal joint. */
export const jointWeights=(above,below,y,width)=>(_x,vertexY)=>{
 const upper=THREE.MathUtils.clamp((vertexY-y)/width+.5,0,1);
 return [[above,upper],[below,1-upper]];
};

/** Bind an independently authored mesh to the avatar's common bind-space skeleton. */
export function bindPart(rig,name,geometry,material,weights){
 const indices=[],values=[],positions=geometry.attributes.position;
 for(let i=0;i<positions.count;i++){
  const pairs=typeof weights==='function'?weights(positions.getX(i),positions.getY(i),positions.getZ(i)):[[weights,1]];
  const sum=pairs.reduce((total,[,weight])=>total+weight,0);
  if(Math.abs(sum-1)>1e-5)throw new Error(`${name}: skin weights must sum to one`);
  for(let j=0;j<4;j++){
   if(pairs[j]&&rig.indices[pairs[j][0]]===undefined)throw new Error(`${name}: unknown bone ${pairs[j][0]}`);
   indices.push(pairs[j]?rig.indices[pairs[j][0]]:0);values.push(pairs[j]?.[1]??0);
  }
 }
 geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(indices,4));geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(values,4));
 const mesh=new THREE.SkinnedMesh(geometry,material);mesh.name=name;mesh.castShadow=true;mesh.frustumCulled=false;
 mesh.bind(rig.skeleton,new THREE.Matrix4());return mesh;
}
