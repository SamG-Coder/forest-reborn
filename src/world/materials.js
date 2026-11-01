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
  const terrainTextures={};
  await Promise.all(['meadow-grass','dry-grass-earth','forest-earth','mountain-stone'].map(async name=>{
    const texture=await loadTexture('/assets/world/'+name+'.png');texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=8;terrainTextures[name]=texture;
  }));
  materials.ground.map=terrainTextures['meadow-grass'];materials.ground.normalScale.set(.12,.12);
  materials.ground.onBeforeCompile=shader=>{
    shader.uniforms.roadMap={value:materials.paving.map};
    shader.uniforms.dryMap={value:terrainTextures['dry-grass-earth']};shader.uniforms.dirtMap={value:terrainTextures['forest-earth']};shader.uniforms.rockMap={value:terrainTextures['mountain-stone']};
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute float roadWeight; attribute float bankWeight; varying float vRoadWeight; varying float vBank; varying vec3 vTerrainWorld; varying float vSlope;');
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvRoadWeight=roadWeight; vBank=bankWeight; vTerrainWorld=(modelMatrix*vec4(position,1.)).xyz; vSlope=1.-normal.y;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform sampler2D roadMap; uniform sampler2D dryMap; uniform sampler2D dirtMap; uniform sampler2D rockMap; varying float vRoadWeight; varying float vBank; varying vec3 vTerrainWorld; varying float vSlope;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
      vec2 groundUV=vMapUv;
      vec3 wideGrass=texture2D(map,vec2(groundUV.y,-groundUV.x)*.317+vec2(.27,.41)).rgb;
      vec3 meadow=mix(diffuseColor.rgb,wideGrass,.35);
      float meadowPatch=.5+.25*sin(groundUV.x*1.61+groundUV.y*.77)+.25*sin(groundUV.y*2.24-groundUV.x*.49);
      float broad=.5+.28*sin(vTerrainWorld.x*.022+vTerrainWorld.z*.017)+.22*sin(vTerrainWorld.z*.051-vTerrainWorld.x*.013);
      meadow=mix(meadow,texture2D(dryMap,groundUV*.87).rgb,smoothstep(.44,.89,broad)*.85);
      float earth=smoothstep(.72,.98,meadowPatch)*.5;
      meadow=mix(meadow,texture2D(dirtMap,groundUV*.9).rgb,max(earth,vBank*.82));
      float fleck=sin(groundUV.x*93.1+sin(groundUV.y*27.2))*sin(groundUV.y*81.7)*.12;
      float paved=smoothstep(.20,.85,vRoadWeight+fleck);
      float shoulder=smoothstep(.0,.4,vRoadWeight)*(1.0-paved);
      vec3 dirt=mix(meadow,texture2D(dirtMap,groundUV).rgb,shoulder*.85);
      float rock=max(smoothstep(.12,.43,vSlope),smoothstep(62.,140.,vTerrainWorld.y));
      vec3 rockTex=texture2D(rockMap,(vTerrainWorld.xz+vTerrainWorld.y*.37)/11.).rgb;
      dirt=mix(dirt,rockTex,rock);
      dirt=mix(dirt,vec3(.82,.87,.88),smoothstep(180.,228.,vTerrainWorld.y)*(1.-vSlope));
      diffuseColor.rgb=mix(dirt,texture2D(roadMap,groundUV*2.5).rgb,paved);
    `);
  };
  materials.ground.customProgramCacheKey=()=> 'world-ground-biomes-v3';
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

