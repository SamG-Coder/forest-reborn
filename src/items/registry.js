import {MALE_MODEL_ID} from '../model/male.js';
import {MALE_RIG_ID} from '../model/rig.js';
import {buildSweptHair,buildShortHair} from './hair.js';
import {buildShirt,buildCoat,buildTrousers,buildBoots,buildGloves,buildBelt} from './clothing.js';
import {buildSword} from './weapons.js';

export const SLOTS=Object.freeze({hair:'Hair style',shirt:'Shirt',outerwear:'Outerwear',legs:'Trousers',hands:'Gloves',feet:'Boots',waist:'Belt',rightHand:'Weapon'});

/** Registration is validated at startup. No UI or renderer state is stored here. */
export class ItemRegistry{
 #items=new Map();
 register(item){
  if(!item.id||this.#items.has(item.id))throw new Error(`Duplicate or missing item ID: ${item.id}`);
  if(!Object.hasOwn(SLOTS,item.slot))throw new Error(`Unknown slot: ${item.slot}`);
  if(typeof item.build!=='function'||!item.models?.length||!item.rigId)throw new Error(`Incomplete item definition: ${item.id}`);
  const entry=Object.freeze({...item,models:Object.freeze([...item.models]),covers:Object.freeze([...(item.covers??[])])});
  this.#items.set(item.id,entry);return this;
 }
 get(id){const item=this.#items.get(id);if(!item)throw new Error(`Item is not registered: ${id}`);return item;}
 list(slot){return [...this.#items.values()].filter(item=>!slot||item.slot===slot);}
}
const common={models:[MALE_MODEL_ID],rigId:MALE_RIG_ID};
export function createItemRegistry(){
 const registry=new ItemRegistry();
 for(const item of [
  {id:'hair.swept-black',name:'Swept / charcoal',slot:'hair',build:buildSweptHair,description:'Layered solid locks; bound to the head.'},
  {id:'hair.short-black',name:'Short / charcoal',slot:'hair',build:buildShortHair,description:'A cropped fringe with separate side locks.'},
  {id:'shirt.linen-ivory',name:'Linen shirt',slot:'shirt',covers:['torso','arms'],build:buildShirt,description:'Sleeves blend across shoulder and elbow joints.'},
  {id:'coat.traveller-teal',name:'Traveller’s coat',slot:'outerwear',build:buildCoat,description:'Open front, separate collar and weighted coat tails.'},
  {id:'legs.traveller-slate',name:'Traveller’s trousers',slot:'legs',covers:['legs','underwear'],build:buildTrousers,description:'Independent left and right legs; blended knee weights.'},
  {id:'hands.leather-brown',name:'Leather gloves',slot:'hands',covers:['hands'],build:buildGloves,description:'Separate fingers and palms; wrist-bound bracers.'},
  {id:'feet.leather-brown',name:'Leather boots',slot:'feet',covers:['feet'],build:buildBoots,description:'Shafts deform at the ankle; feet follow the foot bones.'},
  {id:'waist.traveller-belt',name:'Traveller’s belt',slot:'waist',build:buildBelt,description:'Hip-bound strap, buckle, and two pouches.'},
  {id:'weapon.iron-sword',name:'Iron longsword',slot:'rightHand',build:buildSword,description:'Blade, guard, grip, and pommel follow the right hand.'},
 ])registry.register({...common,...item});
 return registry;
}
export const STARTER_OUTFIT=Object.freeze(['hair.swept-black','shirt.linen-ivory','coat.traveller-teal','legs.traveller-slate','hands.leather-brown','feet.leather-brown','waist.traveller-belt','weapon.iron-sword']);
