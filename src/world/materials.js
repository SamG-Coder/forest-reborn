import {loadTexture} from '../assets/load-texture.js';
import * as THREE from 'three';

export async function loadMaterialSet(names){
  const loader=new THREE.TextureLoader(),materials={};
  await Promise.all(names.map(async name=>{
    const maps=await Promise.all(['basecolor','normal','roughness'].map(async kind=>{
      const texture=await loadTexture(`/assets/world/${name}-${kind}.png`,loader);
      texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.anisotropy=8;
      if(kind==='basecolor')texture.colorSpace=THREE.SRGBColorSpace;return texture;
    }));
    materials[name]=new THREE.MeshToonMaterial({map:maps[0],normalMap:maps[1],normalScale:new THREE.Vector2(.3,.3)});
    // Retain the generated roughness map for a future physical material tier.
    materials[name].userData.roughnessMap=maps[2];
  }));
  return materials;
}

export async function loadWorldMaterials(){
  const materials=await loadMaterialSet(['ground','paving','plaster','roof','masonry','roof-clay','wall-brick','wall-timber','bark','birch-bark']);
  materials.ground.onBeforeCompile=shader=>{
    shader.uniforms.roadMap={value:materials.paving.map};
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute float roadWeight; varying float vRoadWeight;');
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvRoadWeight=roadWeight;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform sampler2D roadMap; varying float vRoadWeight;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
      vec2 groundUV=vMapUv;
      vec3 wideGrass=texture2D(map,vec2(groundUV.y,-groundUV.x)*.317+vec2(.27,.41)).rgb;
      vec3 meadow=mix(diffuseColor.rgb,wideGrass,.35);
      float meadowPatch=.5+.25*sin(groundUV.x*1.61+groundUV.y*.77)+.25*sin(groundUV.y*2.24-groundUV.x*.49);
      vec3 moss=meadow*vec3(.79,1.04,.82),dry=meadow*vec3(1.15,1.02,.81);
      meadow=mix(moss,dry,smoothstep(.18,.78,meadowPatch));
      float fleck=sin(groundUV.x*93.1+sin(groundUV.y*27.2))*sin(groundUV.y*81.7)*.12;
      float paved=smoothstep(.20,.85,vRoadWeight+fleck);
      float shoulder=smoothstep(.0,.4,vRoadWeight)*(1.0-paved);
      vec3 dirt=mix(meadow,vec3(.25,.205,.125),shoulder*.57);
      diffuseColor.rgb=mix(dirt,texture2D(roadMap,groundUV*2.5).rgb,paved);
    `);
  };
  materials.ground.customProgramCacheKey=()=> 'world-ground-patches-v2';
  return materials;
}

/** Box/kit UVs in metres, avoiding a single tile stretched across a whole wall. */
export function metricUV(geometry,metres=2){
  const p=geometry.attributes.position,n=geometry.attributes.normal,uv=[];
  for(let i=0;i<p.count;i++){
    const x=Math.abs(n.getX(i)),y=Math.abs(n.getY(i)),z=Math.abs(n.getZ(i));
    uv.push((x>y&&x>z?p.getZ(i):p.getX(i))/metres,(y>x&&y>z?p.getZ(i):p.getY(i))/metres);
  }
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));return geometry;
}

