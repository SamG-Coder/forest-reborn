import * as T from 'three';
import {createBaseRig} from '../src/avatar/rig.js';
const rig=createBaseRig(new T.Group()),origin=rig.segments.find(s=>s.name==='handR').start;
const center=new T.Vector3(-.074,-.026,.002),axis=new T.Vector3(-Math.sin(.45),0,Math.cos(.45));
function distance(p){const d=p.clone().sub(center);return d.addScaledVector(axis,-d.dot(axis)).length();}
const output={};
for(const finger of ['index','middle','ring','little']){
 const segments=[1,2,3].map(i=>rig.segments.find(s=>s.name===`${finger}${i}R`));
 const base=segments[0].start.clone().sub(origin),deltas=segments.map(s=>s.end.clone().sub(s.start));
 function evaluate(angles){
  let point=base.clone(),angle=0,score=0;const samples=[];
  for(let i=0;i<3;i++){
   angle+=angles[i];const step=deltas[i].clone().applyAxisAngle(new T.Vector3(0,0,1),angle);
   for(const t of [.35,.7,1]){const rho=distance(point.clone().addScaledVector(step,t));samples.push(rho);score+=Math.max(0,.020-rho)**2*120+Math.max(0,rho-.028)**2*12;}
   point.add(step);
  }
  score+=(distance(point)-.023)**2*25;
  score+=(angles[0]+angles[1]+angles[2]-3.15)**2*.00002;
  score+=Math.max(0,point.y+.034)**2*30;
  return{score,samples,tip:point.toArray()};
 }
 let best={score:Infinity};
 for(let a=.3;a<1.81;a+=.1)for(let b=.65;b<1.91;b+=.1)for(let c=.2;c<1.51;c+=.1){const angles=[a,b,c],result=evaluate(angles);if(result.score<best.score)best={...result,angles};}
 for(const delta of [.025,.005]){const start=best.angles;for(let i=-2;i<=2;i++)for(let j=-2;j<=2;j++)for(let k=-2;k<=2;k++){const angles=[start[0]+i*delta,start[1]+j*delta,start[2]+k*delta],result=evaluate(angles);if(result.score<best.score)best={...result,angles};}}
 output[finger]={angles:best.angles.map(v=>+v.toFixed(3)),minRadius:Math.min(...best.samples),maxRadius:Math.max(...best.samples),tip:best.tip};
}
console.log(JSON.stringify(output,null,2));
