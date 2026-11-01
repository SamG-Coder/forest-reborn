import * as THREE from 'three';
import {createHorse} from '../mounts/horse-model.js';
import {terrainHeight} from './terrain.js';

/** Uses the same catalogue and geometry as ridden horses. */
export function createStables(scene,materials){
  const root=new THREE.Group();root.name='Mosswake stables';scene.add(root);const horses=[],colliders=[];
  const wood=materials['wall-timber']??materials.plaster;
  const box=(x,y,z,w,h,d)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),wood);m.position.set(x,terrainHeight(-31,35)+y,z);m.castShadow=m.receiveShadow=true;root.add(m);return m;};
  for(const [i,id]of ['bay','grey','chestnut'].entries()){
    const horse=createHorse({id}),x=-35+i*3.6;horse.root.position.set(x,terrainHeight(-31,35),36.5);horse.root.rotation.y=Math.PI;root.add(horse.root);horses.push(horse);
    colliders.push({minX:x-.6,maxX:x+.6,minZ:35.3,maxZ:37.6});
    box(x,.40,38.8,1.4,.5,.6);
    if(i<2){box(x+1.8,.70,36.6,.12,1.4,3.4);colliders.push({minX:x+1.7,maxX:x+1.9,minZ:34.9,maxZ:38.3});}
  }
  return {root,horses,colliders,update(dt,position){root.visible=Math.hypot(position.x+31,position.z-35)<100;if(root.visible)for(const [i,horse]of horses.entries())horse.update(dt*(1+i*.06),0);}};
}
