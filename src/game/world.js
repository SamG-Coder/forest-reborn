import * as THREE from 'three';
import {createForest} from '../world/forest.js';
import {createTown} from '../world/town.js';
import {terrainHeight} from '../world/terrain.js';
import {loadWorldMaterials} from '../world/materials.js';
import {createWorldResources} from '../world/resources.js';
import {createWorkstations} from '../world/workstations.js';
import {createStables} from '../world/stables.js';
import {createLandscape} from '../world/landscape.js';

export async function createWorld(scene){
  const materials=await loadWorldMaterials(),forest=await createForest(scene,materials),town=createTown(scene,forest.textures.timber,materials,forest.textures['herb-v2']),root=new THREE.Group();scene.add(root);
  const landscape=await createLandscape(scene,materials);
  const resources=createWorldResources(scene,materials,forest.textures['herb-v2'],forest);
  const workstations=createWorkstations(scene,materials,forest.textures.timber);town.colliders.push(...workstations.colliders);
  const stables=createStables(scene,materials);town.colliders.push(...stables.colliders);
  return {root,forest,town,landscape,materials,resources,workstations,stables,targets:[],extraColliders:[],population:null,expansion:null,get colliders(){return forest.colliders;},get buildings(){return [...town.colliders,...this.extraColliders];},
    update(time,position=new THREE.Vector3(),dt=0){forest.update(position,time);landscape.update(time,position,forest.stats(),this.dayNight?.daylight??1);town.update(position);stables.update(dt,position);const near=Math.hypot(position.x,position.z)<245;town.root.visible=near;root.visible=near;for(const node of resources.roots.values())node.visible=near;workstations.root.visible=near;this.townLife?.update(dt);this.expansion?.update(dt,position);this.population?.update(dt,position);if(near)resources.update(Date.now());},
    height:terrainHeight,
  };
}
