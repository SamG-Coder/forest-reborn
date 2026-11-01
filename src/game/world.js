import * as THREE from 'three';
import {createForest} from '../world/forest.js';
import {createTown} from '../world/town.js';
import {terrainHeight,LANDMARKS} from '../world/terrain.js';
import {loadWorldMaterials} from '../world/materials.js';
import {createWorldResources} from '../world/resources.js';
import {createWorkstations} from '../world/workstations.js';
import {createStables} from '../world/stables.js';

export async function createWorld(scene){
  const materials=await loadWorldMaterials(),forest=await createForest(scene,materials),town=createTown(scene,forest.textures.timber,materials,forest.textures['herb-v2']),root=new THREE.Group();scene.add(root);
  const resources=createWorldResources(scene,materials,forest.textures['herb-v2'],forest);
  const workstations=createWorkstations(scene,materials,forest.textures.timber);town.colliders.push(...workstations.colliders);
  const stables=createStables(scene,materials);town.colliders.push(...stables.colliders);
  for(const marker of LANDMARKS.filter(m=>m.id==='bandits'||m.id==='goblins')){
    const material=new THREE.MeshToonMaterial({color:marker.id==='bandits'?'#7e6254':'#8b8c57',side:THREE.DoubleSide,map:materials.plaster.map});
    for(let i=0;i<3;i++){
      const x=marker.x-8+i*7,z=marker.z-9,y=terrainHeight(x,z),group=new THREE.Group();
      const sheet=new THREE.BufferGeometry();sheet.setAttribute('position',new THREE.Float32BufferAttribute([-1.7,0,-1.9,0,2.1,-1.9,1.7,0,-1.9,-1.7,0,1.9,0,2.1,1.9,1.7,0,1.9],3));sheet.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,.5,1,1,0,0,0,.5,1,1,0],2));sheet.setIndex([0,3,1,3,4,1,1,4,2,4,5,2]);sheet.computeVertexNormals();
      const tent=new THREE.Mesh(sheet,material);tent.castShadow=true;group.add(tent);
      for(const dz of [-1.9,1.9]){const pole=new THREE.Mesh(new THREE.CylinderGeometry(.055,.065,2.15,6),new THREE.MeshToonMaterial({color:'#614a32'}));pole.position.set(0,1.075,dz);group.add(pole);}
      group.position.set(x,y,z);root.add(group);
    }
  }
  return {root,forest,town,materials,resources,workstations,stables,targets:[],extraColliders:[],population:null,expansion:null,get colliders(){return forest.colliders;},get buildings(){return [...town.colliders,...this.extraColliders];},
    update(time,position=new THREE.Vector3(),dt=0){forest.update(position,time);town.update(position);stables.update(dt,position);const near=Math.hypot(position.x,position.z)<245;town.root.visible=near;root.visible=near;for(const node of resources.roots.values())node.visible=near;workstations.root.visible=near;this.expansion?.update(dt,position);this.population?.update(dt,position);if(near)resources.update(Date.now());},
    height:terrainHeight,
  };
}
