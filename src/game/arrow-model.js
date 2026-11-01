import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

/** Arrow points along +Z; used in the hand and by the instanced projectile pool. */
export function createArrowGeometry(){
  const parts=[],part=(geometry,color)=>{const rgb=new THREE.Color(color),colors=[];for(let i=0;i<geometry.attributes.position.count;i++)colors.push(rgb.r,rgb.g,rgb.b);geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));parts.push(geometry);};
  const shaft=new THREE.CylinderGeometry(.007,.007,.64,5);shaft.rotateX(Math.PI/2);part(shaft,'#9b7849');
  const tip=new THREE.ConeGeometry(.021,.08,4);tip.rotateX(Math.PI/2);tip.translate(0,0,.36);part(tip,'#bbc7cb');
  for(let i=0;i<3;i++){const feather=new THREE.BoxGeometry(.055,.003,.12);feather.translate(.022,0,-.25);feather.rotateZ(i*Math.PI*2/3);part(feather,'#e9dfc2');}
  const geometry=mergeGeometries(parts);parts.forEach(g=>g.dispose());return geometry;
}
