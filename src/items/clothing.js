import * as THREE from 'three';
import {loft,ellipsoid,box} from '../geometry.js';
import {jointWeights} from '../model/rig.js';
import {TORSO_RINGS} from '../model/male.js';

const SIDES=[['L',1],['R',-1]];
export function buildShirt(add,m){
 add('body',loft(TORSO_RINGS.map(([y,x,z])=>[y,x+.006,z+.006]),24),m.shirt,jointWeights('chest','hips',1.77,.55));
 for(const [side,sign] of SIDES)add(`sleeve_${side}`,loft([[1.53,.082,.075,sign*.545,0],[1.72,.104,.09,sign*.525,0],[1.82,.115,.11,sign*.51,0],[2.02,.14,.13,sign*.46,0],[2.18,.15,.14,sign*.40,0]],16),m.shirt,jointWeights(`upperArm${side}`,`forearm${side}`,1.81,.20));
}
export function buildCoat(add,m){
 add('body',loft(TORSO_RINGS.map(([y,x,z])=>[y,x+.025,z+.018]),24,.40,Math.PI*2-.80),m.coat,jointWeights('chest','hips',1.77,.55));
 for(const [side,sign] of SIDES){
  const collar=new THREE.BoxGeometry(.13,.22,.065);collar.rotateZ(-sign*.25);collar.translate(sign*.145,2.245,.12);add(`collar_${side}`,collar,m.coat,'chest');
  add(`tail_${side}`,loft([[.94,.18,.09,sign*.27,-.08],[1.15,.17,.12,sign*.24,-.09],[1.43,.15,.15,sign*.19,-.04]],12,.45,Math.PI*2-.90),m.coat,`coatTail${side}`);
  add(`shoulder_${side}`,ellipsoid(sign*.39,2.16,0,.18,.16,.16),m.coat,`upperArm${side}`);
 }
}
export function buildTrousers(add,m){
 for(const [side,sign] of SIDES)add(`leg_${side}`,loft([[.26,.10,.095,sign*.18,.02],[.62,.115,.115,sign*.18,0],[.79,.12,.12,sign*.18,0],[1.02,.135,.14,sign*.18,0],[1.25,.15,.16,sign*.18,0],[1.45,.15,.165,sign*.16,0]],16),m.pants,jointWeights(`thigh${side}`,`shin${side}`,.79,.22));
}
export function buildGloves(add,m){
 for(const [side,sign] of SIDES){
  add(`bracer_${side}`,loft([[1.44,.085,.085,sign*.55,.02],[1.55,.10,.095,sign*.54,.01],[1.70,.11,.10,sign*.53,0]]),m.leather,`forearm${side}`);
  add(`palm_${side}`,ellipsoid(sign*.56,1.36,.04,.09,.125,.065),m.leather,`hand${side}`);
  for(let i=0;i<4;i++)add(`finger_${side}_${i}`,ellipsoid(sign*(.505+i*.035),1.24,.055,.018,.065,.025),m.leather,`hand${side}`);
  add(`thumb_${side}`,ellipsoid(sign*.475,1.36,.09,.028,.07,.035),m.leather,`hand${side}`);
 }
}
export function buildBoots(add,m){
 for(const [side,sign] of SIDES){
  add(`shaft_${side}`,loft([[.12,.12,.13,sign*.18,.01],[.31,.115,.125,sign*.18,0],[.53,.125,.125,sign*.18,0],[.57,.135,.135,sign*.18,0]]),m.leather,jointWeights(`shin${side}`,`foot${side}`,.23,.12));
  add(`foot_${side}`,ellipsoid(sign*.18,.13,.105,.125,.125,.24),m.leather,`foot${side}`);
  add(`cuff_${side}`,loft([[.51,.132,.132,sign*.18,0],[.55,.14,.14,sign*.18,0]]),m.gold,`shin${side}`);
 }
}
export function buildBelt(add,m){
 add('strap',loft([[1.43,.265,.185],[1.53,.265,.185]]),m.leather,'hips');
 add('buckle',box(0,1.48,.198,.115,.10,.035),m.gold,'hips');add('buckle_inset',box(0,1.48,.22,.075,.058,.012),m.leather,'hips');
 for(const sign of [-1,1])add(`pouch_${sign}`,box(sign*.26,1.40,.15,.12,.16,.10),m.leather,'hips');
}
