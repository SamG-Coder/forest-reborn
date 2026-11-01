import * as THREE from 'three';
import {BattleSimulation} from './battle-simulation.js';
import {WARFRONT} from './region-layout.js';
import {terrainHeight} from './terrain.js';
import {createCrowd} from '../gear/crowd.js';
import {createHumanoid} from '../npc/humanoid.js';

export const FIELD_ENEMIES=Object.freeze([
  {kind:'ashRaider',weapon:'sword',name:'Ash-company raider',level:9,hp:140,damage:16,scale:1,skin:'#c8a07f',outfit:['clothes.traveller-red','legs.traveller','shoes.traveller','body.leather-vest']},
  {kind:'shieldbreaker',weapon:'sword',name:'Ash-company shieldbreaker',level:11,hp:240,damage:22,scale:1.08,skin:'#b99676',outfit:['clothes.traveller-red','legs.traveller','shoes.traveller','body.riveted-mail','head.iron-open']},
  {kind:'hillGiant',name:'Hillborn giant',level:13,hp:950,damage:34,scale:2.0,skin:'#aaa187',outfit:['legs.starter']},
]);

export async function createWarfront({scene,world,template,registry,gearMaterials,population,camera,save}){
  const root=new THREE.Group();root.name='Highmere east-field battle';scene.add(root);
  const simulation=new BattleSimulation(600),draw=simulation.actors.map(a=>({position:new THREE.Vector3(),matrix:new THREE.Matrix4(),clip:a.clip,phase:a.phase,speed:1,tint:new THREE.Color(a.side<0?'#96bfe0':'#d4a296')}));
  const crowd=await createCrowd(root,draw.length,{actors:draw,extended:true,dynamic:true,weapons:true});
  const enemies=[];
  for(let i=0;i<9;i++){
    const spec=FIELD_ENEMIES[i<5?0:i<8?1:2];
    const actor=await createHumanoid(template,registry,gearMaterials,{kind:spec.kind==='hillGiant'?'ogre':'human',scale:spec.scale,skin:spec.skin,outfit:spec.outfit});
    const x=WARFRONT.x-91+(i%3)*9,z=WARFRONT.z+41+Math.floor(i/3)*12;
    root.add(actor.root);actor.root.position.set(x,terrainHeight(x,z),z);
    const target={...spec,id:`field-${i}`,zoneId:WARFRONT.id,root:actor.root,position:actor.root.position,home:actor.root.position.clone(),maxHp:spec.hp,hp:spec.hp,height:1.25*spec.scale,hostile:true,controller:actor,materials:[actor.avatar.materials.skin],flash:0,stagger:0,windup:0,attackTime:0};
    const old=save.enemies?.find(t=>t.id===target.id);if(old&&old.readyAt>Date.now()){target.hp=0;target.readyAt=old.readyAt;}
    enemies.push(target);world.targets.push(target);population.targets.push(target);
  }
  let accumulator=0;
  return {root,crowd,simulation,enemies,update(dt,player){
    accumulator+=dt;
    if(accumulator>=.1){simulation.update(Math.min(.25,accumulator),(a,damage)=>{
      const position=new THREE.Vector3(a.x+WARFRONT.x,0,a.z+WARFRONT.z);position.y=terrainHeight(position.x,position.z);
      if(position.distanceTo(player)<16&&population.living.damageEvents.length<24)population.living.damageEvents.push({target:{position,height:1.5},amount:damage});
    });accumulator=0;}
    simulation.actors.forEach((a,i)=>{const d=draw[i];d.hidden=a.hp<=0;d.position.set(a.x+WARFRONT.x,0,a.z+WARFRONT.z);d.position.y=terrainHeight(d.position.x,d.position.z);d.clip=a.clip;d.matrix.makeRotationY(a.yaw??0).setPosition(d.position);});
    crowd.update(camera,simulation.time);
  },stats(){return {combatants:simulation.actors.length,fullEnemies:enemies.length,hits:simulation.hits,defeats:simulation.defeats,crowd:crowd.stats()};},dispose(){
    save.enemies=enemies.map(e=>({id:e.id,readyAt:e.readyAt??0}));
    for(const enemy of enemies){world.targets.splice(world.targets.indexOf(enemy),1);population.targets.splice(population.targets.indexOf(enemy),1);enemy.tag?.remove();enemy.controller.dispose();}
    crowd.dispose();root.removeFromParent();
  }};
}
