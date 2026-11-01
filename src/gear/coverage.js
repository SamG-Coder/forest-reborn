import * as THREE from 'three';

export const REGIONS=Object.freeze({scalp:1,face:2,neck:4,chest:8,abdomen:16,pelvis:32,upperArms:64,forearms:128,hands:256,thighs:512,shins:1024,feet:2048,lowerShins:4096,shoulders:8192,waist:16384});
const R=REGIONS;
export const MASK_PROFILES=Object.freeze({none:0,scalp:R.scalp,head:R.scalp|R.face,vest:R.chest|R.abdomen,upper:R.chest|R.abdomen|R.upperArms|R.shoulders|R.waist,pelvis:R.pelvis,legs:R.pelvis|R.thighs|R.shins|R.lowerShins,feet:R.feet,'lower-legs':R.feet|R.lowerShins});

/** The common T-pose space is the mask's stable coordinate system, not the pose. */
export function regionAt(x,y,z){
  const a=Math.abs(x);
  if(y>1.54)return y>1.745?R.scalp:R.face;
  const neckT=THREE.MathUtils.clamp((y-1.49)/.05,0,1);
  const bib=THREE.MathUtils.clamp((1.50-y)/.08,0,1)*.05;
  if(y>1.42&&(x/(.086+.004*neckT+bib))**2+((z+.026)/(.073+.004*neckT+bib))**2<1)return R.neck;
  if(y>1.20&&a>.23)return a>.86?R.hands:a>.40?R.forearms:R.upperArms;
  if(y>1.38)return R.shoulders;
  if(y>1.16)return R.chest;
  if(y>1.10)return R.abdomen;
  if(y>1.065)return R.waist;
  if(y>.82)return R.pelvis;
  if(y>.53)return R.thighs;
  if(y>.39)return R.shins;
  if(y>.18)return R.lowerShins;
  return R.feet;
}

/** Bake one compact coverage label per triangle. Variants reuse this array. */
export function bakeCoverage(geometry){
  const p=geometry.attributes.position,idx=geometry.index;
  const original=idx?Array.from(idx.array):Array.from({length:p.count},(_,i)=>i);
  const labels=new Uint16Array(original.length/3);
  for(let i=0;i<original.length;i+=3){
    for(const id of original.slice(i,i+3))labels[i/3]|=regionAt(p.getX(id),p.getY(id),p.getZ(id));
  }
  return {original,labels};
}
export function applyCoverage(geometry,baked,hidden){
  const indices=[];for(let t=0;t<baked.labels.length;t++)if((baked.labels[t]&hidden)!==baked.labels[t])indices.push(baked.original[t*3],baked.original[t*3+1],baked.original[t*3+2]);
  geometry.setIndex(indices);return indices.length/3;
}
export function resolveCoverage(entries){
  let body=0;const hidden=new Map();
  for(const entry of entries)body|=MASK_PROFILES[entry.mask];
  for(const entry of entries){let mask=0;for(const upper of entries)if(upper.layer>entry.layer)mask|=MASK_PROFILES[upper.mask];hidden.set(entry.id,mask);}
  return {body,hidden};
}

/** Fragment masks remove partial triangles cleanly at collars and hems. The
 * compact triangle bake still strips fully hidden geometry for export/LOD. */
export function setSurfaceCoverage(mesh,hidden){
  const g=mesh.geometry,m=mesh.material;
  if(!g.hasAttribute('gearRest'))g.setAttribute('gearRest',g.attributes.position.clone());
  if(!m.userData.gearCoverage){
    const uniform={value:hidden},compile=m.onBeforeCompile.bind(m),key=m.customProgramCacheKey.bind(m);
    const originalKey=key();m.userData.gearCoverage=uniform;
    m.onBeforeCompile=shader=>{
      compile(shader);shader.uniforms.gearHidden=uniform;
      shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute vec3 gearRest; varying vec3 vGearRest;');
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvGearRest=gearRest;');
      shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
        varying vec3 vGearRest; uniform float gearHidden;
        float gearRegion(vec3 p){float a=abs(p.x);
          if(p.y>1.54)return p.y>1.745?1.:2.;
          float neckT=clamp((p.y-1.49)/.05,0.,1.);
          float bib=clamp((1.50-p.y)/.08,0.,1.)*.05;
          vec2 neck=(p.xz+vec2(0.,.026))/(vec2(.086,.073)+.004*neckT+bib);
          if(p.y>1.42&&dot(neck,neck)<1.)return 4.;
          if(p.y>1.20&&a>.23)return a>.86?256.:a>.40?128.:64.;
          if(p.y>1.38)return 8192.; if(p.y>1.16)return 8.; if(p.y>1.10)return 16.;
          if(p.y>1.065)return 16384.; if(p.y>.82)return 32.; if(p.y>.53)return 512.;
          if(p.y>.39)return 1024.; if(p.y>.18)return 4096.; return 2048.;
        }
      `);
      shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>',`#include <clipping_planes_fragment>
        if(mod(floor(gearHidden/gearRegion(vGearRest)),2.)>.5)discard;
      `);
    };
    m.customProgramCacheKey=()=>`${originalKey}|gear-coverage-v5`;m.needsUpdate=true;
  }
  m.userData.gearCoverage.value=hidden;
}
