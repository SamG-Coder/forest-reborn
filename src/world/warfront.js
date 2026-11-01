import {configureFieldRoster} from '../npc/field-roster.js';
import {ArrowVolley} from '../effects/arrows.js';
import {terrainSampler} from './terrain-sampler.js';
import * as THREE from 'three';
import {BattleSimulation} from './battle-simulation.js';
import {WARFRONT} from './region-layout.js';
import {terrainHeight} from './terrain.js';
import {createNPCInstances} from '../graphics/npc-instances.js';
import {recordHitImpact} from '../game/hit-impact.js';
import {createCampaignCamps} from './campaign-camps.js';
import {battleObstacles,settleBattleSpawns} from './battle-obstacles.js';
import {yieldJob} from './async-jobs.js';
import {BattleOverlays} from '../ui/battle-overlays.js';

export {FIELD_ENEMIES} from '../npc/field-roster.js';

export function createWarfront(context){return createBattleEncounter({...context,site:WARFRONT});}

export async function createBattleEncounter({scene,world,template,registry,gearMaterials,population,camera,renderer,save={},site=WARFRONT,director=null}){
  const factions=population.simulation.factions;
  const simulation=director?await director.loadSimulation(site.id):await BattleSimulation.create(1000,{registry,respawn:true,idPrefix:'east-field:',height:terrainSampler((x,z)=>terrainHeight(site.x+x,site.z+z)),training:[factions.economy.markets.highmere.training,factions.economy.markets.ash.training]});
  if(!simulation)throw new Error('The northern battle requires its quest.');
  if(site.campaign){simulation.walkable=await battleObstacles(site);await settleBattleSpawns(simulation.actors,simulation.walkable);}
  if(!director){simulation.restore(save.battle);configureFieldRoster(simulation,registry);}
  const state=director?.state(site.id)??save;director?.attached.add(site.id);
  const ground=site.campaign?await createCampaignCamps(scene,world.materials,world.height,renderer,camera):null;
  const people=[],units=simulation.actors;
  for(const a of units){
    a.root=new THREE.Object3D();a.position=a.root.position;
    a.position.set(a.x+site.x,simulation.height(a.x,a.z),a.z+site.z);
    a.home=a.position.clone();a.zoneId=site.id;a.kind=a.factionId==='briar'?'goblin':a.factionId==='bandits'?'bandit':a.team?(a.kind??'ashRaider'):'resident';a.hostile=['mosswake','highmere'].includes(a.factionId)?false:factions.hostile(a);a.height=1.35*a.scale+(a.mounted?.7:0);a.aimHeight=1.2*a.scale;a.materials=[];a.flash=0;a.stagger=0;
    a.simulation=simulation;a.onDefeat=killer=>{simulation.die(a,killer);if(killer?.id==='player')director?.contribute('kills',1,site.id);};
    a.pvp={enabled:false,skullUntil:0,combatUntil:0,clearAt:0};
    const person={id:a.id,npcId:a.npcId,name:a.name,type:'soldier',role:simulation.companies[a.squad].name,factionId:a.factionId,externalSchedule:true,target:a,position:a.position,home:a.home,actor:{root:a.root},activity:'Forming up'};
    a.person=person;a.battleLocked=director?!director.isActive(site.id):false;people.push(person);
    if(people.length%64===0)await yieldJob();
  }
  population.corpses.load(state.battleCorpses,units);
  const surface=(x,z)=>simulation.height(x-site.x,z-site.z);
  const crowd=await createNPCInstances({scene,entities:units,profiles:simulation.profiles,template,registry,materials:gearMaterials,height:surface,blood:population.blood,renderer,camera});
  population.residents.push(...people);population.targets.push(...units);world.targets.push(...units);
  const arrows=new ArrowVolley(scene);
  const overlays=new BattleOverlays({canvas:document.querySelector('canvas'),camera,scene,entities:units,companies:simulation.companies,height:terrainHeight,container:document.querySelector('#hud')});
  for(const a of units)a.battleOverlay=overlays;
  const player=population.living.player.target;
  const guest={id:'player',team:director?.save.campaign.chosenSide==='ash'?1:0,position:player.position,receive:(damage,attacker,penetration)=>player.receive(damage,attacker,penetration)};
  Object.defineProperties(guest,{x:{get:()=>player.position.x-site.x},z:{get:()=>player.position.z-site.z},hp:{get:()=>player.hp},yaw:{get:()=>0}});simulation.guests.set('player',guest);
  let outcomeReported=Boolean(save.battle?.outcomeReported),previousStage=null,previousSide=null,displayTime=0;
  const alliedGuests=new Set();
  function saveState(){
    if(!director)save.battle={...simulation.snapshot(),outcomeReported};
    const ids=new Set(units.map(a=>a.id));state.battleCorpses=population.corpses.snapshot().filter(r=>ids.has(r.id));
  }

  return {simulation,crowd,overlays,height:terrainHeight,enemies:units,get playerTeam(){return guest.team;},save:saveState,paused:false,update(dt,observer){
    displayTime+=dt;
    if(director){
      const stage=director.save.campaign.stage,side=director.save.campaign.chosenSide;
      if(stage!==previousStage||side!==previousSide){previousStage=stage;previousSide=side;guest.team=side==='ash'?1:0;for(const a of units){a.battleLocked=stage!=='battle';a.hostile=stage==='battle'&&a.team!==guest.team;}}
      if(stage==='muster'){crowd.update(camera,displayTime,dt);return;}
    }
    // Existing town guards and travelling adventurers enter the same target set.
    for(const person of population.residents){
      if(person.externalSchedule||person.target.hp<=0)continue;
      const local=Math.hypot(person.position.x-site.x,person.position.z-site.z);
      if(local<site.enter&&(person.type==='guard'||person.id==='captain'||person.type==='adventurer')){
        const target=person.target,team=person.companion?guest.team:site.factions?.indexOf(person.factionId??'mosswake')??0;
        if(team<0&&person.type!=='adventurer')continue;
        if(!simulation.guests.has(target.id)){
          const guest={id:target.id,team:Math.max(0,team),position:target.position,receive:(damage,attacker,penetration)=>population.living.damage(attacker,target,damage,Date.now(),penetration)};
          Object.defineProperties(guest,{x:{get:()=>target.position.x-site.x},z:{get:()=>target.position.z-site.z},hp:{get:()=>target.hp},yaw:{get:()=>person.actor.root.rotation.y}});
          simulation.guests.set(target.id,guest);alliedGuests.add(target.id);
        }
        person.deployment={site,team:Math.max(0,team),units,simulation};
      }else if(alliedGuests.has(person.id)){simulation.guests.delete(person.id);alliedGuests.delete(person.id);person.deployment=null;}
    }
    if(this.paused)return;
    simulation.update(dt,(a,amount,attacker)=>{
      if(simulation.guests.has(a.id))return;
      a.position.set(a.x+site.x,simulation.height(a.x,a.z),a.z+site.z);
      if(attacker&&attacker.id!=='player')attacker.position.set(attacker.x+site.x,simulation.height(attacker.x,attacker.z),attacker.z+site.z);
      recordHitImpact(a,attacker,amount);population.blood?.hit(a,attacker,amount,observer,crowd.posePoint(a));
      if(a.position.distanceTo(observer)<45&&population.living.damageEvents.length<100)population.living.damageEvents.push({target:a,amount,group:a.squad});
    });
    for(const event of simulation.events.splice(0))if(event.type==='death')population.defeat(units[event.unit],Date.now(),simulation.unit(event.killer));
    for(const a of units){
      if(a.hp>0&&a.corpse){population.corpses.restore(a);population.blood?.clear(a);factions.memory.respawn(a);}
      a.position.set(a.x+site.x,simulation.height(a.x,a.z),a.z+site.z);a.root.rotation.y=a.yaw;
      a.root.visible=a.hp>0||simulation.time-a.deadAt<25;a.person.activity=simulation.companies[a.squad].order;
    }
    if(!director&&simulation.winner&&!outcomeReported){outcomeReported=true;const winner=simulation.winner<0?'highmere':'ash',loser=winner==='ash'?'highmere':'ash';factions.economy.markets[loser].training=Math.max(0,factions.economy.markets[loser].training-5);factions.economy.receive(loser,'iron',-20);factions.announce((winner==='ash'?'The Ash Company':'Highmere')+' holds the east field. The losing companies need iron and bandages.');}
    crowd.update(camera,simulation.time,dt);arrows.update(simulation.projectiles,simulation.time,site);
    if(director)director.resolve(site,simulation);
  },stats(){return {...simulation.stats(),registeredNPCs:units.length,crowd:crowd.stats()};},dispose(){
    saveState();director?.attached.delete(site.id);ground?.dispose();
    for(const person of population.residents)if(person.deployment?.simulation===simulation)person.deployment=null;
    for(const id of alliedGuests)simulation.guests.delete(id);
    const ids=new Set(units.map(a=>a.id));
    for(const list of [world.targets,population.targets,population.residents]){let write=0;for(const entry of list)if(!ids.has(entry.id))list[write++]=entry;list.length=write;}
    for(const a of units){population.corpses.restore(a);a.tag?.remove();}arrows.dispose();overlays.dispose();crowd.dispose();
  }};
}
