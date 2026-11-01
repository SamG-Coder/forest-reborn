import * as THREE from 'three';

/** Correct the reconstruction's upper-back occlusion bulge before skinning.
 * The source side image includes an end-on hand/arm at shoulder height; its
 * silhouette is not a reliable sagittal torso section in that region. */
export function correctUpperBody(geometry) {
  const p=geometry.attributes.position;
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i);
    const central=1-THREE.MathUtils.smoothstep(Math.abs(x),.12,.29);
    const region=THREE.MathUtils.smoothstep(y,1.19,1.32)*(1-THREE.MathUtils.smoothstep(y,1.47,1.56));
    const back=1-THREE.MathUtils.smoothstep(z,-.025,.025);
    p.setZ(i,z*(1-.30*central*region*back));
  }
  // Weld only for smoothing adjacency; retain the original UV vertex splits.
  const groups=[],byPosition=new Map(),vertexGroup=[];
  for(let i=0;i<p.count;i++){
    const key=[p.getX(i),p.getY(i),p.getZ(i)].map(v=>Math.round(v*1e6)).join(':');
    if(!byPosition.has(key)){byPosition.set(key,groups.length);groups.push({ids:[],neighbors:new Set(),p:new THREE.Vector3().fromBufferAttribute(p,i)});}
    const id=byPosition.get(key);groups[id].ids.push(i);vertexGroup.push(id);
  }
  const index=geometry.index;
  for(let i=0;i<index.count;i+=3){const ids=[0,1,2].map(j=>vertexGroup[index.getX(i+j)]);for(const a of ids)for(const b of ids)if(a!==b)groups[a].neighbors.add(b);}
  for(let pass=0;pass<8;pass++){
    const next=groups.map(group=>{
      const {x,y}=group.p;
      const strength=.35*(1-THREE.MathUtils.smoothstep(Math.abs(x),.24,.36))*THREE.MathUtils.smoothstep(y,1.20,1.30)*(1-THREE.MathUtils.smoothstep(y,1.55,1.60));
      if(!strength||!group.neighbors.size)return group.p.clone();
      const average=new THREE.Vector3();for(const id of group.neighbors)average.add(groups[id].p);average.divideScalar(group.neighbors.size);
      return group.p.clone().lerp(average,strength);
    });
    groups.forEach((group,i)=>group.p.copy(next[i]));
  }
  for(const group of groups)for(const i of group.ids)p.setXYZ(i,group.p.x,group.p.y,group.p.z);
  correctNeckDepth(geometry);
  return geometry;
}

/** A depth-only posture correction below the jaw. Never scale the neck or
 * project it onto a cylinder: that also narrows the adjacent mandible. */
export function correctNeckDepth(geometry) {
  const p=geometry.attributes.position;
  for(let i=0;i<p.count;i++) {
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i);
    const height=THREE.MathUtils.smoothstep(y,1.46,1.505)*(1-THREE.MathUtils.smoothstep(y,1.535,1.58));
    const rearHeight=THREE.MathUtils.smoothstep(y,1.46,1.505)*(1-THREE.MathUtils.smoothstep(y,1.535,1.65));
    const central=1-THREE.MathUtils.smoothstep(Math.abs(x),.06,.115);
    const back=1-THREE.MathUtils.smoothstep(z,-.085,-.025);
    p.setZ(i,z+central*(height*.009*(1-back)+rearHeight*.027*back));
  }
  return geometry;
}
