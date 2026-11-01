import * as THREE from 'three';
import {terrainHeight} from './terrain.js';
import {roadEdgeDistance} from './layout.js';

/** A terrain continuation for long battlefield camera shots. Near the player
 * the ordinary high-detail forest chunks remain in charge of the surface. */
export function createBattleGround(scene,materials,site){
  const size=1120,segments=280,g=new THREE.PlaneGeometry(size,size,segments,segments);g.rotateX(-Math.PI/2);
  const p=g.attributes.position,uv=g.attributes.uv,weights=[];
  for(let i=0;i<p.count;i++){
    const x=p.getX(i)+site.x,z=p.getZ(i)+site.z;p.setXYZ(i,x,terrainHeight(x,z)-.22,z);uv.setXY(i,x/7,z/7);
    weights.push(Math.max(0,1-roadEdgeDistance(x,z)/2));
  }
  g.setAttribute('roadWeight',new THREE.Float32BufferAttribute(weights,1));g.computeVertexNormals();
  const material=materials.ground.clone();material.onBeforeCompile=materials.ground.onBeforeCompile;material.customProgramCacheKey=materials.ground.customProgramCacheKey;
  const mesh=new THREE.Mesh(g,material);mesh.receiveShadow=true;scene.add(mesh);
  return {update(){},dispose(){mesh.removeFromParent();g.dispose();material.dispose();}};
}
