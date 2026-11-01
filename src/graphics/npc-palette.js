import {PEDESTRIAN_SPEED} from '../game/locomotion-speed.js';
import * as THREE from 'three';
import {createBaseRig} from '../avatar/rig.js';
import {attachSword} from '../game/weapon-sockets.js';
import {weaponAction} from '../game/weapon-catalog.js';
import {applyRiderPose} from '../mounts/rider-pose.js';
import {CharacterAnimator} from '../game/animation.js';
import {finishJob} from '../world/async-jobs.js';

export const paletteBase=(grip,mounted=false)=>grip==='unarmed'?60:grip==='bow'?(mounted?54:48):(mounted?24:0)+(grip==='spear'?6:grip==='two-hand'?12:grip==='shield'?18:0);

export function createNPCPalette(frames=48){
  const job=paletteJob(frames);let result;while(!(result=job.next()).done){}return result.value;
}

export function createNPCPaletteAsync(frames=48){return finishJob(paletteJob(frames));}

function* paletteJob(frames){
  const root=new THREE.Group(),rig=createBaseRig(root),width=THREE.MathUtils.ceilPowerOfTwo(rig.skeleton.bones.length*4),clips=66,data=new Float32Array(width*frames*clips*4);
  attachSword(rig,new THREE.Group());
  const restPositions=rig.skeleton.bones.map(bone=>bone.position.clone());
  for(let clip=0;clip<clips;clip++){
    const poseClip=clip%6,weapon=clip>=60?'unarmed':clip>=48?'weapon.shortbow':['sword','weapon.spear','weapon.greatsword','weapon.shortshield'][Math.floor(clip%24/6)];
    rig.reset();rig.skeleton.bones.forEach((bone,i)=>bone.position.copy(restPositions[i]));
    const animator=new CharacterAnimator({root,rig}),speed=poseClip===1?PEDESTRIAN_SPEED.walk:poseClip===2?PEDESTRIAN_SPEED.run:0;
    for(let n=0;n<60;n++){animator.update(1/60,{speed,weapon,grounding:false});if(n%8===0)yield;}
    for(let f=0;f<frames;f++){
      const action=poseClip===3||poseClip===4?{kind:weaponAction(weapon).kind,style:weaponAction(weapon).animation??'cut',weapon,side:'R',combo:poseClip-3,height:1.25,progress:f/(frames-1)}:null;
      animator.update(1/60,{speed,weapon,action,block:poseClip===5,grounding:false,scrubPhase:f/frames});
      if(clip>=24&&clip<48||clip>=54&&clip<60)applyRiderPose({root,rig},{weapon,action,block:poseClip===5});
      root.updateMatrixWorld(true);rig.skeleton.update();data.set(rig.skeleton.boneMatrices,(clip*frames+f)*width*4);
      if(f%8===0)yield;
    }
  }
  const texture=new THREE.DataTexture(data,width,frames*clips,THREE.RGBAFormat,THREE.FloatType);texture.needsUpdate=true;
  return {texture,width,frames,rig,root,data};
}

export function instancedNPCMaterial(source,palette,ragdolls){
  const material=source.clone(),compile=source.onBeforeCompile.bind(source),key=source.customProgramCacheKey();
  material.onBeforeCompile=shader=>{
    compile(shader);
    Object.assign(shader.uniforms,{npcPalette:{value:palette.texture},npcFrames:{value:palette.frames},npcRagdolls:{value:ragdolls.texture}});
    shader.vertexShader=shader.vertexShader.replace('#include <common>',`#include <common>
      attribute vec4 skinIndex; attribute vec4 skinWeight;
      attribute vec4 npcPose; attribute vec2 npcState;
      uniform highp sampler2D npcPalette; uniform highp sampler2D npcRagdolls; uniform float npcFrames;
      mat4 npcBone(float index,float row,bool rag){int x=int(index)*4;int y=int(row);
        if(rag)return mat4(texelFetch(npcRagdolls,ivec2(x,y),0),texelFetch(npcRagdolls,ivec2(x+1,y),0),texelFetch(npcRagdolls,ivec2(x+2,y),0),texelFetch(npcRagdolls,ivec2(x+3,y),0));
        return mat4(texelFetch(npcPalette,ivec2(x,y),0),texelFetch(npcPalette,ivec2(x+1,y),0),texelFetch(npcPalette,ivec2(x+2,y),0),texelFetch(npcPalette,ivec2(x+3,y),0));
      }
      mat4 npcSkinAt(float row,bool rag){
        mat4 skin=npcBone(skinIndex.x,row,rag)*skinWeight.x;
        if(skinWeight.y>0.)skin+=npcBone(skinIndex.y,row,rag)*skinWeight.y;
        if(skinWeight.z>0.)skin+=npcBone(skinIndex.z,row,rag)*skinWeight.z;
        if(skinWeight.w>0.)skin+=npcBone(skinIndex.w,row,rag)*skinWeight.w;
        return skin;
      }
      mat4 npcFrame(float clip,float phase){float frame=clamp(phase,0.,.99999)*(npcFrames-1.);float row=clip*npcFrames;return npcSkinAt(row+floor(frame),false)*(1.-fract(frame))+npcSkinAt(row+ceil(frame),false)*fract(frame);}
    `);
    shader.vertexShader=shader.vertexShader.replace('void main() {',`void main() {
      mat4 npcSkin;
      if(npcState.y>=0.)npcSkin=npcSkinAt(npcState.y,true);
      else {npcSkin=npcFrame(npcPose.x,npcPose.y);if(npcState.x<.999)npcSkin=npcSkin*npcState.x+npcFrame(npcPose.z,npcPose.w)*(1.-npcState.x);}
    `);
    if(source.userData.heldArrow)shader.vertexShader=shader.vertexShader.replace('heldArrowShown=heldArrowVisible;', 'heldArrowShown=(npcState.y<0. && npcPose.x>=48. && (mod(npcPose.x,6.)==3. || mod(npcPose.x,6.)==4.) && npcPose.y>.12 && npcPose.y<.64)?1.:0.;');
    shader.vertexShader=shader.vertexShader.replace('#include <beginnormal_vertex>','#include <beginnormal_vertex>\nobjectNormal=mat3(npcSkin)*objectNormal;');
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed=(npcSkin*vec4(transformed,1.)).xyz;');
  };
  material.customProgramCacheKey=()=>key+'|shared-npc-palette-v3';return material;
}
