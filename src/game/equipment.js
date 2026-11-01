import * as THREE from 'three';
import { attachSword, SWORD_GRIP } from './weapon-sockets.js';
import {metalResource} from '../gear/resources.js';

const PRACTICE_SWORD=Object.freeze({id:'weapon.practice-sword',slot:'rightHand',name:'Practice sword'});
const toon=color=>new THREE.MeshToonMaterial({color,side:THREE.DoubleSide});

// Animation equipment is independent of the future clothing system.
export function equipPracticeSword(avatar){
  const sword=new THREE.Group();sword.name='weapon.practice-sword';
  const blade=new THREE.Mesh(new THREE.BoxGeometry(.045,.65,.012),toon('#dce7ed'));blade.position.y=.38;
  const guard=new THREE.Mesh(new THREE.BoxGeometry(.19,.027,.035),toon('#c7a566'));guard.position.y=.045;
  const grip=new THREE.Mesh(new THREE.CylinderGeometry(SWORD_GRIP.radius,SWORD_GRIP.radius,.18,16),toon('#654539'));grip.position.y=-.045;
  sword.add(blade,guard,grip);attachSword(avatar.rig,sword);
  avatar.equipment.set('weapon.practice-sword',{definition:PRACTICE_SWORD,mesh:sword});
  return {sword,setMetal(id){const metal=metalResource(id);blade.material.color.set(metal.color);guard.material.color.set(metal.color);}};
}
