import {removeItem} from '../progression/inventory.js';

import {ARROWS} from './arrow-catalog.js';
export {ARROWS} from './arrow-catalog.js';

export function selectedArrow(data){
  const count=id=>data.bag?.reduce((sum,stack)=>sum+(stack?.id===id?stack.count:0),0)??data.ammunition?.[id]??0;
  if(ARROWS[data.arrow]&&count(data.arrow)>0)return data.arrow;
  return Object.keys(ARROWS).reverse().find(id=>count(id)>0)??null;
}
export function spendArrow(data){
  const id=selectedArrow(data);if(!id)return null;
  if(data.bag)data.bag=removeItem(data.bag,id,1);else data.ammunition[id]--;
  return {id,...ARROWS[id]};
}
const point=unit=>({x:unit.x??unit.position.x,y:(unit.position?.y??unit.y??0)+(unit.aimHeight??1.35),z:unit.z??unit.position.z});

/** Aimed at the target's predicted position on release, not a homing arrow.
 * Both RPG actors and army units use the same flight and dodge window. */
export function createArrowShot(source,target,{time=0,speed=34,damage=20,arrow=ARROWS['arrow.wood']}={}){
  const from=point(source),to=point(target),duration=Math.max(.12,Math.hypot(to.x-from.x,to.y-from.y,to.z-from.z)/speed);
  to.x+=(target.vx??0)*duration;to.z+=(target.vz??0)*duration;
  return {source:source.id,target:target.id,from,to,start:time,end:time+duration,damage:damage+(arrow.damage??0),penetration:arrow.penetration??0,arc:Math.min(3,duration*1.6)};
}
export function arrowPosition(shot,time,out={}){
  const t=Math.max(0,Math.min(1,(time-shot.start)/(shot.end-shot.start)));
  out.x=shot.from.x+(shot.to.x-shot.from.x)*t;out.z=shot.from.z+(shot.to.z-shot.from.z)*t;
  out.y=shot.from.y+(shot.to.y-shot.from.y)*t+4*shot.arc*t*(1-t);return out;
}
export function arrowHits(shot,target){
  if(!target||target.hp<=0)return false;const p=point(target);
  return Math.hypot(p.x-shot.to.x,p.z-shot.to.z)<1.25*(target.scale??1)&&Math.abs(p.y-shot.to.y)<2;
}
