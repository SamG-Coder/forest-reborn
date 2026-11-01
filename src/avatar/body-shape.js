import * as THREE from 'three';
import {cutGarment} from './clothing.js';
import {bindAvatarMesh} from './rig.js';

const restPositions=new WeakMap();
const restIndices=new WeakMap();
const smooth=THREE.MathUtils.smoothstep;
export const BODY_TYPES=Object.freeze({male:'Male',female:'Female'});

/** Rest-space proportions shared by skin and sewn equipment. Bone pivots,
 * vertex order, UVs and skin weights remain compatible with the common rig. */
export function applyBodyShape(geometry,type='male'){
  const p=geometry.attributes.position;
  if(!restPositions.has(geometry)){restPositions.set(geometry,p.array.slice());restIndices.set(geometry,geometry.index?.clone()??null);}
  const rest=restPositions.get(geometry);
  p.array.set(rest);
  if(type==='female')for(let i=0;i<p.count;i++){
    const x=rest[i*3],y=rest[i*3+1],z=rest[i*3+2],a=Math.abs(x);
    if(y>1.52)continue; // Preserve the accepted head, UV face and helmet fit.
    if(a>.29&&y>1.25){p.setXYZ(i,x,1.43+(y-1.43)*.83,z*.83);continue;}
    const torso=(1-smooth(a,.22,.33)),waist=Math.exp(-(((y-1.12)/.15)**2));
    const hip=Math.exp(-(((y-.91)/.13)**2));
    const chest=Math.exp(-(((y-1.31)/.085)**2))*Math.exp(-(((a-.085)/.07)**2))*smooth(z,.03,.12);
    p.setXYZ(i,x*(1+torso*(hip*.10-waist*.09)),y,z*(1-torso*waist*.06)+chest*.025);
  }
  // Clothing hides triangles, but must not change the normals at skin seams.
  const visibleIndex=geometry.index;geometry.setIndex(restIndices.get(geometry));
  p.needsUpdate=true;geometry.computeVertexNormals();geometry.setIndex(visibleIndex);geometry.computeBoundingSphere();
  return geometry;
}

export function createBodySystem(avatar){
  avatar.sourceBody??=avatar.body.geometry.clone();avatar.sourceUnderwear??=avatar.underwear.geometry.clone();
  const source=avatar.sourceBody.clone(),indices=Array.from(source.index.array);
  source.setIndex(indices.filter((_,i)=>{
    const start=i-i%3;return indices.slice(start,start+3).every(j=>Math.abs(source.attributes.position.getX(j))<.25);
  }));
  const material=avatar.materials.underwear.clone();material.color.set('#ded4bc');
  const baseTop=bindAvatarMesh(cutGarment(source,1.10,1.38,.004),material,avatar.rig,'base.underlayer');source.dispose();avatar.root.add(baseTop);
  const api={
    setType(type){
      if(!Object.hasOwn(BODY_TYPES,type))throw new Error(`Unknown body type: ${type}`);
      avatar.bodyType=type;
      for(const mesh of [avatar.body,avatar.underwear,baseTop])applyBodyShape(mesh.geometry,type);
      baseTop.visible=type==='female';
    },
    updateCoverage(covered){baseTop.visible=avatar.bodyType==='female'&&!covered;},
    baseTop,
  };
  avatar.bodySystem=api;api.setType('male');return api;
}
