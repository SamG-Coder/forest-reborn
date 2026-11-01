import {Vector3} from 'three';
import {random,terrainHeight} from '../world/terrain.js';
import {createRabbit} from './rabbit.js';

export const RABBIT_HABITATS=Object.freeze([
  {id:'south-meadow',name:'South meadow',x:65,z:67,radius:14,count:5},
  {id:'west-copse',name:'West copse',x:-69,z:31,radius:13,count:4},
  {id:'east-orchard',name:'East orchard',x:91,z:40,radius:14,count:4},
  {id:'north-verge',name:'North verge',x:-48,z:-80,radius:12,count:3},
]);

/** Bounded goals chosen on traversable ground, never the old fixed spawn grid. */
export function habitatPoint(habitat,rng,navigation,from=null){
  for(let i=0;i<32;i++){
    const angle=rng()*Math.PI*2,radius=Math.sqrt(rng())*habitat.radius;
    const x=habitat.x+Math.cos(angle)*radius,z=habitat.z+Math.sin(angle)*radius;
    if(navigation.walkable(x,z)&&(!from||navigation.segmentClear(from,{x,z})))return new Vector3(x,terrainHeight(x,z),z);
  }
  if(from)return from.clone();
  return new Vector3(habitat.x,terrainHeight(habitat.x,habitat.z),habitat.z);
}

export function createMeadowRabbits(scene,navigation){
  const targets=[];let index=0;
  for(const habitat of RABBIT_HABITATS)for(let n=0;n<habitat.count;n++,index++){
    const rng=random(4391+index*109),model=createRabbit({variant:index%4}),spawn=habitatPoint(habitat,rng,navigation);
    model.root.position.copy(spawn);model.root.rotation.y=rng()*Math.PI*2;scene.add(model.root);
    const target={id:`rabbit-${index}`,kind:'rabbit',name:habitat.id==='south-meadow'?'Meadow rabbit':`${model.coat.name} rabbit`,level:1,root:model.root,position:model.root.position,home:spawn.clone(),height:.48,pickHeight:.85,pickRadius:.35,maxHp:22,hp:22,materials:model.materials,flash:0,stagger:0,respawn:0,attackTime:0,windup:0,hostile:false,habitat};
    target.wildlife={model,rng,wait:1+rng()*5,goal:null,mode:'graze',respawn(){const point=habitatPoint(habitat,rng,navigation);target.position.copy(point);target.home.copy(point);target.escapeGoal=null;this.goal=null;this.wait=2+rng()*3;}};
    targets.push(target);
  }
  return targets;
}

export function updateWildlife(target,dt,{player,units,navigation,move,animate=true}){
  const life=target.wildlife;if(!life||target.hp<=0||target.dormant)return;
  const startX=target.position.x,startZ=target.position.z;
  life.wait-=dt;
  // React to the nearby hunter as well as the human player, without sprinting forever.
  let threat=target.hp<target.maxHp?player:null;
  let nearest=threat?Math.hypot(threat.x-startX,threat.z-startZ):Infinity;
  for(const unit of units){if(unit.target?.hp<=0)continue;const distance=Math.hypot(unit.position.x-startX,unit.position.z-startZ);if(distance<2.3&&distance<nearest){nearest=distance;threat=unit.position;}}
  const playerDistance=Math.hypot(player.x-startX,player.z-startZ);
  if(playerDistance<1.6&&playerDistance<nearest){nearest=playerDistance;threat=player;}
  const startled=threat&&nearest<(target.hp<target.maxHp?10:2.3);
  if(startled&&(!life.goal||life.mode!=='flee'||life.wait<=0)){
    const angle=Math.atan2(startX-threat.x,startZ-threat.z);
    for(const turn of [0,.7,-.7,1.4,-1.4,Math.PI]){
      const x=startX+Math.sin(angle+turn)*5,z=startZ+Math.cos(angle+turn)*5;
      if(navigation.walkable(x,z)&&navigation.segmentClear(target.position,{x,z})){life.goal=new Vector3(x,0,z);break;}
    }
    life.mode='flee';life.wait=1.6;
  }else if(!life.goal&&life.wait<=0){life.goal=habitatPoint(target.habitat,life.rng,navigation,target.position);life.mode='roam';life.wait=10;}
  if(life.goal){
    const gap=Math.hypot(life.goal.x-startX,life.goal.z-startZ);
    if(gap>.35&&life.wait>0)move(target,life.goal,dt,life.mode==='flee'?2.6:.68);
    else{life.goal=null;life.mode=life.rng()>.35?'graze':'watch';life.wait=2+life.rng()*5;}
  }
  const speed=dt>0?Math.hypot(target.position.x-startX,target.position.z-startZ)/dt:0;
  target.moveSpeed=speed;target.moving=speed>.04;target.position.y=terrainHeight(target.position.x,target.position.z);
  if(animate)life.model.update(Math.min(dt,.1),{speed,grazing:life.mode==='graze',alert:life.mode==='watch'||startled});
}
