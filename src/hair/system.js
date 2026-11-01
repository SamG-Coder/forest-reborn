import {loadTexture} from '../assets/load-texture.js';
import * as THREE from 'three';


import {createFittedHelmet} from '../gear/headwear.js';
import {HAIR_STYLES} from './catalog.js';

import {buildHairStyle} from './authored-styles.js';
export {HAIR_STYLES} from './catalog.js';

let texturePromise;
export async function createHairSystem(avatar,fitted=null){
  const texture=await (texturePromise??=loadTexture('/assets/hair/fibres-neutral.png').then(t=>{t.colorSpace=THREE.SRGBColorSpace;t.wrapS=THREE.RepeatWrapping;t.anisotropy=8;return t;}));
  const hat={value:0},material=new THREE.MeshToonMaterial({color:'#362d31',map:texture,side:THREE.DoubleSide});
  material.onBeforeCompile=shader=>{
    shader.uniforms.hairHat=hat;
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 hairRest;');
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nhairRest=position;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 hairRest; uniform float hairHat;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#ifdef USE_MAP
      vec4 strandTexel=texture2D(map,vMapUv);
      float strandTone=dot(strandTexel.rgb,vec3(.2126,.7152,.0722));
      diffuseColor.rgb*=mix(.88,1.08,strandTone);
      #endif`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>',`#include <clipping_planes_fragment>
      if(hairHat>.5){vec3 d=hairRest-vec3(0.,1.69,-.024);float front=sin(atan(d.z,d.x));
        float limit=1.60-.40*max(0.,front)+.35*max(0.,-front);
        if(acos(clamp(normalize(d).y,-1.,1.))<limit+.025)discard;
      }`);
  };material.customProgramCacheKey=()=> 'hair-headwear-clumps-v2';
  let style='none',meshes=[],ownsFit=!fitted;
  const fit=fitted??createFittedHelmet(avatar.body.geometry),headIndex=avatar.rig.segments.find(s=>s.name==='head').index;
  function add(geometry,isCap=false){
    const count=geometry.attributes.position.count,ids=new Uint16Array(count*4),weights=new Float32Array(count*4);
    for(let i=0;i<count;i++){ids[i*4]=headIndex;weights[i*4]=1;}
    geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(ids,4));geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));
    const mesh=new THREE.SkinnedMesh(geometry,material);mesh.name=`hair.${style}`;mesh.userData.isCap=isCap;mesh.bind(avatar.rig.skeleton,new THREE.Matrix4());mesh.castShadow=true;mesh.frustumCulled=false;avatar.root.add(mesh);meshes.push(mesh);
  }
  const api={
    setStyle(id){
      if(!Object.hasOwn(HAIR_STYLES,id))throw new Error(`Unknown hairstyle: ${id}`);
      if(id===style)return;
      for(const mesh of meshes){mesh.removeFromParent();mesh.geometry.dispose();}meshes=[];style=id;
      if(id==='none')return;
      const built=buildHairStyle(id,fit.shell);add(built.cap,true);if(built.locks)add(built.locks);
      if(built.accessories){
        add(built.accessories);meshes.at(-1).userData.accessory='bare';
        const lowered=buildHairStyle(id,fit.shell,true);lowered.cap.dispose();lowered.locks?.dispose();
        if(lowered.accessories){add(lowered.accessories);meshes.at(-1).userData.accessory='hat';}
      }
      api.setHeadwear(hat.value?{}:null);
    },
    setColor(color){material.color.set(color);},
    setHeadwear(item){hat.value=item?1:0;for(const mesh of meshes){if(mesh.userData.isCap||mesh.userData.accessory==='bare')mesh.visible=!item;if(mesh.userData.accessory==='hat')mesh.visible=Boolean(item);}},
    get style(){return style;},get meshes(){return meshes;},get covered(){return Boolean(hat.value);},
    dispose(){for(const mesh of meshes){mesh.removeFromParent();mesh.geometry.dispose();}material.dispose();if(ownsFit){fit.shell.dispose();fit.rim.dispose();}},
  };
  avatar.hair=api;return api;
}

