import * as THREE from 'three';
import {loadTexture} from './assets/load-texture.js';

/** Shared three-band ramp. Materials are owned by the asset library, not individual actors. */
export function createRamp(){
 const data=new Uint8Array([85,85,85,255,180,180,180,255,255,255,255,255]);
 const texture=new THREE.DataTexture(data,3,1,THREE.RGBAFormat);
 texture.minFilter=texture.magFilter=THREE.NearestFilter;texture.needsUpdate=true;return texture;
}
export async function loadMaterials(){
 const loader=new THREE.TextureLoader();const ramp=createRamp();
 const entries=await Promise.all(['male-head-atlas','warrior-face','warrior-hair','warrior-coat','warrior-leather','bark','grass'].map(async name=>{
  const t=await loadTexture(`/assets/${name}.png`,loader);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return [name,t];
 }));
 const textures=Object.fromEntries(entries);
 const toon=(color,map)=>new THREE.MeshToonMaterial({color,gradientMap:ramp,map:map?textures[map]:null,side:THREE.DoubleSide});
 return {textures,ramp,toon,skin:toon('#f9cba9'),face:toon('#ffffff','male-head-atlas'),hair:toon('#ffffff','warrior-hair'),
  coat:toon('#ffffff','warrior-coat'),leather:toon('#ffffff','warrior-leather'),shirt:toon('#eee8d6'),pants:toon('#313b48'),
  gold:toon('#d4ad61'),steel:toon('#d9eaf0'),dark:toon('#172a36'),bark:toon('#c6b397','bark'),
  grass:new THREE.MeshToonMaterial({map:textures.grass,gradientMap:ramp,side:THREE.DoubleSide,alphaTest:.45}),
 };
}
