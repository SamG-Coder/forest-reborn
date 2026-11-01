import {shapeGoblin} from './goblin.js';
import * as THREE from 'three';
import {createBaseRig} from '../avatar/rig.js';
import {createAvatarMaterials} from '../avatar/materials.js';
import {LayeredEquipment} from '../gear/equipment.js';
import {CharacterAnimator} from '../game/animation.js';
import {equipPracticeSword} from '../game/equipment.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {JobAnimation} from './job-animation.js';
import {createBodySystem} from '../avatar/body-shape.js';

function combineGarments(wardrobe,rig){
  for(const entry of wardrobe.entries.values()){
    const groups=new Map();
    for(const mesh of entry.meshes){
      if(!mesh.visible)continue;
      if(!groups.has(mesh.material))groups.set(mesh.material,[]);groups.get(mesh.material).push(mesh);
    }
    for(const [material,meshes]of groups){
      if(meshes.length<2)continue;
      const geometry=mergeGeometries(meshes.map(m=>m.geometry));if(!geometry)continue;
      const combined=new THREE.SkinnedMesh(geometry,material);combined.bind(rig.skeleton,new THREE.Matrix4());combined.castShadow=true;combined.receiveShadow=true;combined.frustumCulled=false;
      for(const mesh of meshes){mesh.removeFromParent();mesh.visible=false;}entry.group.add(combined);entry.meshes.push(combined);
    }
  }
}

/** Clone the accepted male geometry and its weights; use an independent skeleton. */
export async function createHumanoid(template,registry,gearMaterials,{kind='human',outfit=[],skin='#dbaf8d',scale=1,face=0,build=1,bodyType='male'}={}){
  const root=new THREE.Group(),rig=createBaseRig(root),materials=await createAvatarMaterials();
  const body=new THREE.SkinnedMesh((template.sourceBody??template.body.geometry).clone(),materials.skin);body.bind(rig.skeleton,new THREE.Matrix4());body.frustumCulled=false;root.add(body);
  if(template.baseIndices)body.geometry.setIndex(template.baseIndices);
  const underwear=new THREE.SkinnedMesh((template.sourceUnderwear??template.underwear.geometry).clone(),materials.underwear);underwear.bind(rig.skeleton,new THREE.Matrix4());underwear.frustumCulled=false;root.add(underwear);
  materials.setSkin(skin);
  materials.setFace(face);materials.setEye(['#536b79','#695a3b','#6b7862','#92836f','#735343'][face%5]);
  if(kind==='ogre'||kind==='ogreChampion'){
    const p=body.geometry.attributes.position;
    for(let i=0;i<p.count;i++){
      const x=p.getX(i),y=p.getY(i),z=p.getZ(i),torso=THREE.MathUtils.smoothstep(y,1,1.25)*(1-THREE.MathUtils.smoothstep(y,1.48,1.57));
      p.setXYZ(i,x*(1+torso*.2),y,z*(1+torso*.35));
    }
    p.needsUpdate=true;body.geometry.computeVertexNormals();materials.setEye('#bd863b');
  }
  if(kind==='goblin'){shapeGoblin(body.geometry);materials.setEye('#e2b452');}
  root.scale.set(scale*build,scale,scale*build);
  const avatar={root,rig,body,underwear,materials,equipment:new Map(),gearTemplates:template.gearTemplates};
  createBodySystem(avatar);avatar.bodySystem.setType(bodyType);
  const wardrobe=new LayeredEquipment(avatar,registry,gearMaterials);wardrobe.simulate=false;wardrobe.apply(outfit);
  combineGarments(wardrobe,rig);
  const animator=new CharacterAnimator(avatar),weapon=equipPracticeSword(avatar),jobs=new JobAnimation(avatar);
  animator.update(1,{speed:0,weapon:'unarmed',grounding:false});weapon.sword.visible=false;
  for(const mesh of [body,underwear]){mesh.castShadow=true;mesh.receiveShadow=true;}
  return {avatar,wardrobe,animator,weapon,root,update(dt,{speed=0,armed=false,seated=false,action=null,activity='rest',travelAngle=0}={}){
    animator.update(dt,{speed,weapon:armed?'sword':'unarmed',grounding:false,action,travelAngle});weapon.sword.visible=armed;
    if(seated){rig.bones.thighL.rotation.x=-1.35;rig.bones.thighR.rotation.x=-1.35;rig.bones.shinL.rotation.x=1.35;rig.bones.shinR.rotation.x=1.35;}
    if(kind==='goblin')rig.bones.chest.rotation.x+=.035;
    if(action)jobs.clear();else jobs.update(dt,activity,speed>.05);
    wardrobe.update(dt);
  },dispose(){wardrobe.dispose();root.removeFromParent();root.traverse(o=>{if(o.isMesh){o.geometry.dispose();o.material.dispose();}});}};
}
