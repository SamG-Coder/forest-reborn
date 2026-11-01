import * as THREE from 'three';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {createAnimationClips} from '../model/animation.js';

/** glTF uses portable PBR materials. The local renderer restores toon shading on import. */
export async function exportModel(model,equipment){
 const animations=createAnimationClips(model),originals=new Map(),converted=new Map();
 model.root.userData={modelId:model.id,rigId:model.rig.id,equippedItems:equipment.ids(),shading:'three-band-toon'};
 const convert=source=>{
  if(!converted.has(source))converted.set(source,new THREE.MeshStandardMaterial({color:source.color,map:source.map,roughness:.9,side:source.side}));
  return converted.get(source);
 };
 model.root.traverse(object=>{
  if(!object.isMesh)return;originals.set(object,object.material);
  object.material=Array.isArray(object.material)?object.material.map(convert):convert(object.material);
 });
 try{return await new GLTFExporter().parseAsync(model.root,{binary:true,animations,onlyVisible:true});}
 finally{for(const [object,material] of originals)object.material=material;for(const material of converted.values())material.dispose();}
}
export function download(data,name,type){const url=URL.createObjectURL(new Blob([data],{type}));const link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
