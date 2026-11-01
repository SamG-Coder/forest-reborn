import {Vector3} from 'three';
import {facePoint} from '../npc/motion.js';
import {terrainHeight} from '../world/terrain.js';

/** Camp work uses the same finite resource nodes and pathfinder as adventurers. */
export function updateFactionRoutine(target,dt,now,population,resources,player){
  if(!target.hostile||target.hp<=0||target.dormant||target.wildlife)return;
  const factions=population.simulation.factions;factions.assign(target);
  if((target.engagedUntil??0)>now||target.position.distanceTo(player)<18&&factions.hostile(target))return;
  const home=target.home;
  if(!target.campGoal||now>target.campGoal.until){
    const need=factions.economy.needs(target.factionId)[0];
    const node=resources.available().find(n=>n.kind===need?.item&&Math.hypot(n.x-home.x,n.z-home.z)<28);
    target.campGoal={until:now+16000,node:node?.id,x:node?.x??home.x+Math.sin(now*.0001+home.x)*3,z:node?.z??home.z+Math.cos(now*.0001+home.z)*3,worked:false};
  }
  const goal=target.campGoal,node=goal.node&&resources.available().find(n=>n.id===goal.node);
  const point=new Vector3(goal.x,0,goal.z),distance=Math.hypot(point.x-target.position.x,point.z-target.position.z);
  target.moveSpeed=distance>1.6?population.move(target,point,dt,1.1):0;target.moving=target.moveSpeed>.05;target.position.y=terrainHeight(target.position.x,target.position.z);
  target.activity=node?`Gathering ${node.kind} for ${target.factionId}`:'Guarding the camp';
  if(distance<1.8&&node&&!goal.worked){
    facePoint(target,node);goal.work=(goal.work??0)+dt;
    if(goal.work>=3){const kind=resources.harvest(node.id,target.position,now);if(kind)factions.economy.receive(target.factionId,kind,kind==='wood'?3:1);goal.worked=true;}
  }
}
