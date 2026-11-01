import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

/** Merge opt-in rigid meshes in spatial cells. Animated/skinned objects, their
 * visibility and their transforms remain independent. Materials and UVs survive. */
export function batchStaticMeshes(root,{select=o=>o.userData.staticBatch,cellSize=24}={}){
  root.updateMatrixWorld(true);const inverse=root.matrixWorld.clone().invert(),groups=new Map(),point=new THREE.Vector3();
  root.traverse(mesh=>{
    if(!mesh.isMesh||mesh.isSkinnedMesh||mesh.isInstancedMesh||Array.isArray(mesh.material)||!select(mesh))return;
    mesh.getWorldPosition(point).applyMatrix4(inverse);
    const attributes=Object.keys(mesh.geometry.attributes).sort().join(','),key=[Math.floor(point.x/cellSize),Math.floor(point.z/cellSize),mesh.material.uuid,mesh.castShadow,mesh.receiveShadow,attributes].join(':');
    if(!groups.has(key))groups.set(key,[]);groups.get(key).push(mesh);
  });
  let removed=0,created=0;const geometries=[];
  for(const meshes of groups.values()){
    if(meshes.length<2)continue;
    const parts=meshes.map(mesh=>{const g=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone();g.applyMatrix4(inverse.clone().multiply(mesh.matrixWorld));return g;});
    const geometry=mergeGeometries(parts);parts.forEach(g=>g.dispose());if(!geometry)continue;
    const first=meshes[0],batch=new THREE.Mesh(geometry,first.material);batch.castShadow=first.castShadow;batch.receiveShadow=first.receiveShadow;batch.name='static batch';geometry.computeBoundingSphere();root.add(batch);
    geometries.push(geometry);
    for(const mesh of meshes){mesh.removeFromParent();mesh.geometry.dispose();removed++;}created++;
  }
  return {removed,created,savedDraws:removed-created,geometries};
}
