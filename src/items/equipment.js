import * as THREE from 'three';
import {bindPart} from '../model/rig.js';

/** Equipment owns item geometry; the model owns the shared skeleton and materials. */
export class Equipment{
 constructor(model,registry){this.model=model;this.registry=registry;this.equipped=new Map();}
 equip(id){
  const definition=this.registry.get(id);
  if(!definition.models.includes(this.model.id)||definition.rigId!==this.model.rig.id)throw new Error(`${id} is not compatible with ${this.model.id}`);
  if(this.equipped.get(definition.slot)?.definition.id===id)return;
  const group=new THREE.Group();group.name=id;group.userData.itemId=id;group.userData.slot=definition.slot;
  // Build first. A bad replacement must not destroy the item already equipped.
  try{definition.build((name,geometry,material,weights)=>{
   const mesh=bindPart(this.model.rig,`${id}_${name}`,geometry,material,weights);group.add(mesh);
  },this.model.materials);}catch(error){this.#disposeGroup(group);throw error;}
  this.unequip(definition.slot);this.model.root.add(group);this.equipped.set(definition.slot,{definition,group});this.#updateCoverage();
 }
 unequip(slot){const entry=this.equipped.get(slot);if(!entry)return;this.model.root.remove(entry.group);this.#disposeGroup(entry.group);this.equipped.delete(slot);this.#updateCoverage();}
 apply(ids){
  // Validate every reference and compatibility before changing the current outfit.
  const definitions=ids.map(id=>this.registry.get(id)),slots=new Set();
  for(const definition of definitions){
   if(slots.has(definition.slot))throw new Error(`Two items occupy ${definition.slot}`);slots.add(definition.slot);
   if(!definition.models.includes(this.model.id)||definition.rigId!==this.model.rig.id)throw new Error(`Incompatible item: ${definition.id}`);
  }
  for(const slot of [...this.equipped.keys()])if(!slots.has(slot))this.unequip(slot);
  for(const id of ids)this.equip(id);
 }
 ids(){return [...this.equipped.values()].map(entry=>entry.definition.id);}
 #updateCoverage(){const covered=new Set();for(const {definition} of this.equipped.values())for(const region of definition.covers)covered.add(region);this.model.setCoveredRegions(covered);}
 #disposeGroup(group){group.traverse(object=>{if(object.isMesh)object.geometry.dispose();});}
 dispose(){for(const slot of [...this.equipped.keys()])this.unequip(slot);}
}
