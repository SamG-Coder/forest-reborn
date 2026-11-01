import * as THREE from 'three';
import {MUSTER_CAMPS} from './battle-sites.js';
import {warmMeshes} from '../graphics/warm-meshes.js';
import {yieldJob} from './async-jobs.js';

export async function createCampaignCamps(scene,materials,height,renderer,camera){
  const root=new THREE.Group();root.name='Northern muster camps';root.visible=false;scene.add(root);const owned=[];
  const add=(geometry,material,x,y,z)=>{const mesh=new THREE.Mesh(geometry,material);mesh.position.set(x,height(x,z)+y,z);mesh.castShadow=true;root.add(mesh);return mesh;};
  for(const camp of MUSTER_CAMPS){
    const cloth=new THREE.MeshToonMaterial({color:camp.color,side:THREE.DoubleSide,map:materials.plaster.map});owned.push(cloth);
    for(let i=0;i<8;i++){
      await yieldJob();
      const x=camp.x+(i%4-1.5)*7,z=camp.z+(i<4?-7:7);
      const tent=add(new THREE.ConeGeometry(2.8,2.3,4,1,true),cloth,x,1.15,z);tent.rotation.y=Math.PI/4;
      add(new THREE.BoxGeometry(1,.8,.8),materials.bark,x+2,.4,z);
    }
    add(new THREE.CylinderGeometry(.08,.13,6,8),materials.bark,camp.x,3,camp.z);
    add(new THREE.PlaneGeometry(2.8,1.8),cloth,camp.x+1.4,4.6,camp.z);
  }
  if(renderer&&camera)await warmMeshes(renderer,camera,scene,[...root.children]);
  root.visible=true;
  return {root,dispose(){root.traverse(o=>o.geometry?.dispose());owned.forEach(m=>m.dispose());root.removeFromParent();}};
}
