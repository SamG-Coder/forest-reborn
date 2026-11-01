import * as THREE from 'three';
import {loft,ellipsoid} from '../geometry.js';
import {createMaleRig,bindPart,jointWeights} from './rig.js';
import {buildMaleHead} from './head.js';

export const MALE_MODEL_ID='male-v1';
export const TORSO_RINGS=[[1.40,.22,.14],[1.58,.23,.155],[1.82,.28,.175],[2.05,.34,.18],[2.19,.32,.145],[2.27,.145,.115]];

/** The base body has no class, hairstyle, clothing, or weapon dependencies. */
export function createMaleModel(materials){
 const root=new THREE.Group();root.name='Model_Male';root.userData.modelId=MALE_MODEL_ID;
 const rig=createMaleRig(root),bodyParts=new Map();
 function add(region,name,geometry,material,weights){
  const mesh=bindPart(rig,name,geometry,material,weights);mesh.userData.bodyRegion=region;root.add(mesh);
  if(!bodyParts.has(region))bodyParts.set(region,[]);bodyParts.get(region).push(mesh);return mesh;
 }
 add('neck','male_neck',loft([[2.25,.12,.11],[2.5,.12,.11]]),materials.skin,'neck');
 buildMaleHead(add,materials);
 add('torso','male_torso',loft(TORSO_RINGS,24),materials.skin,jointWeights('chest','hips',1.77,.55));
 // Base shorts preserve a usable, clothed preview when no trouser item is equipped.
 add('underwear','male_base_shorts',loft([[1.12,.27,.17],[1.40,.25,.17],[1.48,.23,.155]],20),materials.pants,'hips');
 for(const [side,sign] of [['L',1],['R',-1]]){
  add('arms',`male_arm_${side}`,loft([[1.45,.065,.065,sign*.55,.02],[1.65,.08,.075,sign*.53,0],[1.80,.085,.085,sign*.51,0],[1.99,.11,.105,sign*.46,0],[2.17,.13,.125,sign*.40,0]],16),materials.skin,jointWeights(`upperArm${side}`,`forearm${side}`,1.80,.20));
  add('hands',`male_palm_${side}`,ellipsoid(sign*.56,1.36,.04,.08,.12,.06),materials.skin,`hand${side}`);
  for(let i=0;i<4;i++)add('hands',`male_finger_${side}_${i}`,ellipsoid(sign*(.51+i*.032),1.24,.055,.016,.065,.024),materials.skin,`hand${side}`);
  add('hands',`male_thumb_${side}`,ellipsoid(sign*.483,1.36,.085,.025,.065,.03),materials.skin,`hand${side}`);
  add('legs',`male_leg_${side}`,loft([[.18,.075,.085,sign*.18,.02],[.4,.09,.09,sign*.18,0],[.65,.105,.105,sign*.18,0],[.79,.105,.105,sign*.18,0],[1.01,.125,.13,sign*.18,0],[1.25,.14,.145,sign*.18,0],[1.42,.14,.15,sign*.16,0]],16),materials.skin,jointWeights(`thigh${side}`,`shin${side}`,.79,.22));
  add('feet',`male_foot_${side}`,ellipsoid(sign*.18,.10,.10,.105,.10,.20),materials.skin,`foot${side}`);
 }
 return {id:MALE_MODEL_ID,root,rig,bodyParts,materials,
  setCoveredRegions(regions){for(const [name,meshes] of bodyParts)for(const mesh of meshes)mesh.visible=!regions.has(name);},
  dispose(){for(const meshes of bodyParts.values())for(const mesh of meshes)mesh.geometry.dispose();rig.skeleton.dispose();}
 };
}
