import * as THREE from 'three';
import {publicUrl} from '../assets/public-url.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createBaseRig, bindAvatarMesh } from './rig.js';
import { createAvatarMaterials } from './materials.js';
import { MALE_BASE_ID, STARTER_UNDERWEAR } from './catalog.js';
import { cutGarment } from './clothing.js';
import { refineHead } from './head-shape.js';
import {createBodySystem} from './body-shape.js';

export async function createMaleAvatar() {
  const [{scene:source},materials]=await Promise.all([new GLTFLoader().loadAsync(publicUrl('/models/male-uv-body.glb')),createAvatarMaterials()]);
  const parts=[];
  source.traverse(node=>{if(node.isMesh)parts.push(node.geometry.clone());});
  const root=new THREE.Group();root.name=MALE_BASE_ID;
  const rig=createBaseRig(root);
  const baseGeometry=mergeGeometries(parts);
  const bodyGeometry=refineHead(baseGeometry);
  const body=bindAvatarMesh(bodyGeometry,materials.skin,rig,'male.base.body');root.add(body);
  const garment=cutGarment(baseGeometry,.82,1.045);
  baseGeometry.dispose();parts.forEach(part=>part.dispose());
  const underwear=bindAvatarMesh(garment,materials.underwear,rig,STARTER_UNDERWEAR.id);root.add(underwear);
  const equipment=new Map([[STARTER_UNDERWEAR.id,{definition:STARTER_UNDERWEAR,mesh:underwear}]]);
  const helper=new THREE.SkeletonHelper(root);helper.visible=false;
  const avatar={id:MALE_BASE_ID,root,rig,body,underwear,equipment,materials,helper};createBodySystem(avatar);return avatar;
}
