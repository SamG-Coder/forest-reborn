import * as THREE from 'three';
import { attachSword, SWORD_GRIP } from './weapon-sockets.js';
import {metalResource} from '../gear/resources.js';
import {createShieldModel,createWeaponModel} from './weapon-model.js';
import {BOW_GRIP,createBowString,createNockedArrow} from './bow-model.js';
import {swordGripOrientation} from './weapon-sockets.js';
import {weaponAction} from './weapon-catalog.js';

const PRACTICE_SWORD=Object.freeze({id:'weapon.practice-sword',slot:'rightHand',name:'Practice sword'});
const toon=color=>new THREE.MeshToonMaterial({color,side:THREE.DoubleSide});

// Animation equipment is independent of the future clothing system.
export function equipPracticeSword(avatar){
  const shield=createShieldModel();avatar.rig.bones.handL.add(shield);
  const sword=new THREE.Group();sword.name='weapon.practice-sword';
  let model=createWeaponModel('sword'),current='sword';sword.add(model);attachSword(avatar.rig,sword);
  const rightSocket=sword.parent,leftSocket=new THREE.Object3D();leftSocket.name='socket.leftBowGrip';leftSocket.userData.bindBone='handL';leftSocket.position.fromArray(BOW_GRIP);leftSocket.quaternion.copy(swordGripOrientation());avatar.rig.bones.handL.add(leftSocket);
  let string=null,nockedArrow=null,visible=true;Object.defineProperty(sword,'visible',{get:()=>visible,set:value=>{visible=value;shield.visible=value&&current==='weapon.shortshield';if(string)string.visible=value;if(nockedArrow)nockedArrow.visible=value;},configurable:true});sword.visible=false;
  avatar.equipment.set('weapon.practice-sword',{definition:PRACTICE_SWORD,mesh:sword});
  return {sword,setWeapon(id){
    if(id===current)return;current=id;shield.visible=visible&&id==='weapon.shortshield';model.removeFromParent();model.traverse(o=>{if(o.isMesh){o.geometry.dispose();o.material.dispose();}});
    model=createWeaponModel(id);sword.add(model);sword.userData.markers.bladeTip.position.y=.08+model.userData.length;
    if(string){string.removeFromParent();string.geometry.dispose();string.material.dispose();string=null;}
    if(nockedArrow){nockedArrow.removeFromParent();nockedArrow.geometry.dispose();nockedArrow.material.dispose();nockedArrow=null;delete avatar.root.userData.nockedArrow;}
    if(weaponAction(id).ranged){nockedArrow=createNockedArrow(avatar);nockedArrow.visible=visible;leftSocket.add(sword);sword.position.set(0,0,0);string=createBowString(avatar,model.userData.half);string.visible=visible;}
    else {rightSocket.add(sword);sword.position.set(0,.05,0);}
  },setMetal(id){if(weaponAction(current).ranged)return;model.userData.blade.material.color.set(metalResource(id).color);}};
}
