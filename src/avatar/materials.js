import {loadTexture} from '../assets/load-texture.js';
import * as THREE from 'three';
import { FACE_STYLES, BODY_STYLES, STARTER_UNDERWEAR } from './catalog.js';

let sourcePromise;
async function loadSources() {
  const loader=new THREE.TextureLoader();
  const faces=await Promise.all(FACE_STYLES.map(async face=>({detail:await loadTexture(face.detail,loader),mask:await loadTexture(face.irisMask,loader)})));
  const bodies=await Promise.all(BODY_STYLES.map(body=>loadTexture(body.map,loader)));
  for(const texture of [...faces.flatMap(f=>[f.detail,f.mask]),...bodies]) { texture.flipY=false;texture.colorSpace=THREE.NoColorSpace; }
  for(const texture of bodies){texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(4,4);}
  const ramp=new THREE.DataTexture(new Uint8Array([115,185,235,255]),4,1,THREE.RedFormat);
  ramp.minFilter=ramp.magFilter=THREE.NearestFilter;ramp.needsUpdate=true;
  const fabric=await loadTexture(STARTER_UNDERWEAR.map,loader);fabric.colorSpace=THREE.SRGBColorSpace;fabric.wrapS=fabric.wrapT=THREE.RepeatWrapping;fabric.repeat.set(5,2);
  return {faces,bodies,ramp,fabric};
}
export async function createAvatarMaterials() {
  const {faces,bodies,ramp,fabric}=await (sourcePromise??=loadSources());
  const uniforms={faceMap:{value:faces[0].detail},irisMask:{value:faces[0].mask},eyeTint:{value:new THREE.Color('#548cab')}};
  const skin=new THREE.MeshToonMaterial({color:'#efc4a3',map:bodies[0],gradientMap:ramp});
  skin.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,uniforms);
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute vec2 faceUv; varying vec2 vFaceUv; varying float vFaceFront;');
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvFaceUv=faceUv;vFaceFront=smoothstep(0.0,.025,position.z);');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec2 vFaceUv; varying float vFaceFront; uniform sampler2D faceMap; uniform sampler2D irisMask; uniform vec3 eyeTint;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`
      float grain=texture2D(map,vMapUv).r;
      diffuseColor.rgb *= .96 + (grain-.7)*.18;
      vec4 face=texture2D(faceMap,vFaceUv);
      float iris=texture2D(irisMask,vFaceUv).r;
      vec3 ink=vec3(pow(face.r,2.2));
      ink=mix(ink,eyeTint*(.3+face.r*1.7),iris);
      float inFace=step(0.,vFaceUv.x)*step(vFaceUv.x,1.)*step(0.,vFaceUv.y)*step(vFaceUv.y,1.)*vFaceFront;
      diffuseColor.rgb=mix(diffuseColor.rgb,ink,face.a*inFace);
    `);
  };
  skin.customProgramCacheKey=()=> 'male-layered-face-v1';
  const underwear=new THREE.MeshToonMaterial({color:'#545e6a',map:fabric,gradientMap:ramp,side:THREE.DoubleSide});
  underwear.onBeforeCompile=shader=>{
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying float vGarmentHeight;');
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvGarmentHeight=uv.y;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying float vGarmentHeight;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
      float waistband=smoothstep(.87,.88,vGarmentHeight);
      float hem=1.-smoothstep(.025,.035,vGarmentHeight);
      diffuseColor.rgb*=mix(1.0,.55,max(waistband,hem));
    `);
  };
  underwear.customProgramCacheKey=()=> 'male-starter-underwear-v1';
  return {skin,underwear,faces,bodies,uniforms,
    setFace(index){uniforms.faceMap.value=faces[index].detail;uniforms.irisMask.value=faces[index].mask;},
    setBody(index){skin.map=bodies[index];skin.needsUpdate=true;},
    setEye(color){uniforms.eyeTint.value.set(color);},setSkin(color){skin.color.set(color);},
  };
}
