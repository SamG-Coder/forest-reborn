import {loadTexture} from '../assets/load-texture.js';
import {publicUrl} from '../assets/public-url.js';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MATERIAL_FAMILIES} from './catalog.js';
import {metalResource} from './resources.js';

export async function loadGearMaterials(){
  const loader=new THREE.TextureLoader(),textures={};
  const templates={};
  await Promise.all(['tunic','mail','vest'].map(async name=>{
    const template=await new GLTFLoader().loadAsync(publicUrl(`/models/gear-${name}.glb`));
    template.scene.traverse(o=>{if(o.isMesh)templates[name]=o.geometry;});
  }));
  await Promise.all(['cloth','leather','mail','iron','brocade','engraved'].map(async name=>{
    const [map,normalMap,roughnessMap]=await Promise.all(['basecolor','normal','roughness'].map(kind=>loadTexture(`/assets/gear/${name}-${kind}.png`,loader)));
    map.colorSpace=THREE.SRGBColorSpace;
    const repeat=name==='mail'?3:['brocade','engraved'].includes(name)?1.4:4;
    for(const texture of [map,normalMap,roughnessMap]){texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(repeat,repeat);texture.anisotropy=8;}
    textures[name]={map,normalMap,roughnessMap};
  }));
  await Promise.all(['white-cotton','casual-denim'].map(async name=>{
    const map=await loadTexture(`/assets/modern/${name}.png`,loader);map.colorSpace=THREE.SRGBColorSpace;
    map.wrapS=map.wrapT=THREE.RepeatWrapping;map.repeat.set(4,4);map.anisotropy=8;textures[name]={map};
  }));
  const ramp=new THREE.DataTexture(new Uint8Array([100,170,220,255]),4,1,THREE.RedFormat);ramp.minFilter=ramp.magFilter=THREE.NearestFilter;ramp.needsUpdate=true;
  return {
    templates,
    create(item){
      const family=MATERIAL_FAMILIES[item.material],maps=textures[item.finish&&item.finish!=='plain'?item.finish:family.map],resource=item.resource?metalResource(item.resource):null;
      if(!maps)throw new Error(`Unknown material finish: ${item.finish}`);
      const props={color:resource?.color??item.color,map:maps.map,normalMap:maps.normalMap,normalScale:new THREE.Vector2(.38,.38),side:THREE.DoubleSide};
      const material=family.metalness>0?new THREE.MeshStandardMaterial({...props,metalness:resource?.metalness??family.metalness,roughness:resource?Math.min(1,resource.roughness/.6):1,roughnessMap:maps.roughnessMap,envMapIntensity:.5}):new THREE.MeshToonMaterial({...props,gradientMap:ramp});
      material.name=`gear.${item.material}`;return material;
    },
    dispose(){ramp.dispose();for(const template of Object.values(templates))template.dispose();for(const maps of Object.values(textures))for(const map of Object.values(maps))map.dispose();},
  };
}
