import {loft,hairLock} from '../geometry.js';

/** Hair is authored in head bind-space and weighted rigidly to the head bone. */
export function buildSweptHair(add,m){
 add('cap',loft([[2.67,.25,.21,0,-.025],[2.84,.269,.245,0,-.015],[3.00,.23,.20],[3.09,.08,.08],[3.10,.001,.001]],24),m.hair,'head');
 for(let i=0;i<11;i++){
  const x=(i-5)*.047,tipY=2.72+Math.abs(i-5)*.009+(i%3)*.035;
  add(`fringe_${i}`,hairLock([[x*.65,3.06,.07],[x,2.99,.22],[x+.035,2.86,.255],[x+.06,tipY,.225]],.052,.034),m.hair,'head');
 }
 for(let i=0;i<15;i++){
  const angle=i/14*Math.PI*1.5+Math.PI*.25,x=Math.sin(angle),z=Math.cos(angle);
  add(`outer_lock_${i}`,hairLock([[x*.10,3.07,z*.10],[x*.245,2.98,z*.22],[x*.29,2.82,z*.25],[x*.275,2.61+(i%3)*.045,z*.24]],.06,.035),m.hair,'head');
 }
 add('cowlick',hairLock([[0,3.05,-.03],[.09,3.18,-.03],[.19,3.16,-.01],[.22,3.10,.01]],.04,.026),m.hair,'head');
}
export function buildShortHair(add,m){
 add('short_cap',loft([[2.76,.25,.22,0,-.035],[2.94,.25,.225],[3.05,.15,.15],[3.08,.001,.001]],24),m.hair,'head');
 for(let i=0;i<9;i++){
  const x=(i-4)*.054;
  add(`short_fringe_${i}`,hairLock([[x*.7,3.04,.09],[x,2.96,.22],[x-.025,2.81+(i%3)*.025,.225]],.045,.025),m.hair,'head');
 }
 for(const sign of [-1,1])add(`sideburn_${sign}`,hairLock([[sign*.23,2.95,.01],[sign*.26,2.8,.025],[sign*.235,2.64,.01]],.05,.026),m.hair,'head');
}
