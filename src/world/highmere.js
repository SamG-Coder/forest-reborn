import * as THREE from 'three';
import {createTown} from './town.js';
import {terrainHeight} from './terrain.js';
import {HIGHMERE,HIGHMERE_PLOTS} from './region-layout.js';
import {createCastle} from './castle.js';
import {createHumanoid} from '../npc/humanoid.js';
import {createHairSystem} from '../hair/system.js';
import {flagState} from '../npc/society.js';
import {createWorkstations,HIGHMERE_WORKSTATIONS} from './workstations.js';
import {citizenLook} from '../npc/citizen-looks.js';
import {createCityTrees} from './city-trees.js';
import {CASTLE_HOUSEHOLD,updateHousehold} from './castle-household.js';
import {createSettlementDetails} from './settlement-details.js';
import {DailySchedule} from '../npc/daily-schedule.js';
import {updateFacing} from '../npc/motion.js';
import {HIGHMERE_WORK_CYCLES} from './work-cycles.js';
import {yieldJob} from './async-jobs.js';

export const CITY_RESIDENTS=Object.freeze([
  {id:'highmere-marshal',name:'Captain Elian',role:'Field marshal',x:858,z:-795,action:'read',outfit:'plate',greeting:'The Ash patrols are ranging farther from their camps. Keep an eye on the eastern road.'},
  {id:'highmere-guild',name:'Mira',role:'Guild registrar',gender:'female',x:819,z:-850,action:'read',greeting:'Names on this side. Bounty reports on the other. Which one are you here for?'},
  {id:'highmere-smith',name:'Doran',role:'Armourer',x:818,z:-805,action:'hammer',greeting:'A split ring is cheap to fix. A split shoulder is not. Let me see your mail.'},
  {id:'highmere-tailor',name:'Lysa',role:'Tailor',gender:'female',x:885,z:-852,action:'sew',greeting:'Hold still a moment. That hem will catch on your boots.'},
  {id:'highmere-cook',name:'Nella',role:'Innkeeper',gender:'female',x:883,z:-805,action:'cook',greeting:'There is stew left, if you are quick. The next patrol is due in.'},
  {id:'highmere-scribe',name:'Corin',role:'Archivist',x:885,z:-893,action:'read',greeting:'You woke up with no record of arriving? You are not the first. Start with your name.'},
  ...CASTLE_HOUSEHOLD,
]);

export async function createHighmere({scene,world,template,registry,gearMaterials,population,camera,renderer,save}){
  const root=new THREE.Group();root.name='Highmere active zone';root.visible=false;scene.add(root);
  await yieldJob();
  const town=createTown(root,world.forest.textures.timber,world.materials,world.forest.textures['herb-v2'],{plots:HIGHMERE_PLOTS,name:'Highmere streets',decorations:false});
  const details=createSettlementDetails(root,{plots:HIGHMERE_PLOTS,materials:world.materials,timber:world.forest.textures.timber,city:true,dayNight:world.dayNight});
  await yieldJob();
  const stations=createWorkstations(root,world.materials,world.forest.textures.timber,{definitions:HIGHMERE_WORKSTATIONS});
  world.workstations.stations.push(...stations.stations);
  const fort=await createCastle(root,world.materials),trees=createCityTrees(root,world.materials,world.forest.textures);
  const unregisterLamps=world.dayNight.register(fort.interiorLights);
  const unregisterGates=world.townLife?.registerGates('highmere',fort.gates);
  const colliders=[...town.colliders,...fort.colliders,...stations.colliders,...trees.colliders,...details.colliders];
  world.extraColliders.push(...colliders);population.navigation.add('highmere',colliders,HIGHMERE,170);
  const residents=[],schedule=new DailySchedule({clock:world.dayNight.clock,population,details,townId:'highmere'});
  const workers=details.jobs.map((job,i)=>({...job,id:'highmere-'+job.id,name:['Ada','Fen','Tessa','Oswin'][i],x:job.position.x,z:job.position.z,gender:i%2?'male':'female',greeting:['The apples came in this morning. Take the bruised ones if you are cooking.','Give that loaf a moment. It is still hot.','I can patch a sleeve. A whole winter coat takes longer.','Keep the road clear, please. There is another cart coming.'][i]}));
  workers.push({id:'highmere-porter',name:'Hale',role:'Market porter',x:882,z:-778,action:'carry'}, {id:'highmere-gardener',name:'Sera',gender:'female',role:'Gardener',x:800,z:-818,action:'gather'}, {id:'highmere-fletcher',name:'Rhea',gender:'female',role:'Fletcher',x:810,z:-844.4,action:'saw',greeting:'The watch needs another bundle. Pass me those feathers, would you?'});
  const patrol=[[850,-747],[850,-789],[897,-830],[850,-878],[806,-830]].map(([x,z])=>new THREE.Vector3(x,0,z));
  const guards=Array.from({length:8},(_,i)=>({id:'highmere-guard-'+i,name:['Rowan','Petra','Giles','Anwen','Oren','Mara','Benn','Elsa'][i],gender:i%2?'female':'male',role:i<4?'Day watch':'Night watch',type:'guard',x:patrol[i%5].x+(i%2?2:-2),z:patrol[i%5].z,action:'watch',outfit:'plate',nightShift:i>=4}));
  for(const [index,definition]of [...CITY_RESIDENTS,...workers,...guards].entries()){
    await yieldJob();
    const look=citizenLook(index+14),outfit=[...(definition.clothes??look.outfit.filter(id=>!id.endsWith('/body')))];
    if(definition.outfit)outfit.push('body.iron-cuirass','head.iron-open');
    const actor=await createHumanoid(template,registry,gearMaterials,{bodyType:definition.gender??look.gender,skin:look.skin,face:index%5,outfit});
    root.add(actor.root);actor.root.position.set(definition.x,terrainHeight(definition.x,definition.z),definition.z);actor.root.rotation.y=definition.face??Math.PI;
    const hair=await createHairSystem(actor.avatar,template.gearTemplates.helmet);hair.setStyle(definition.gender==='female'?'braid':look.hair);hair.setColor(look.hairColor);hair.setHeadwear(actor.wardrobe.entries.get('head')?.definition);
    const archer=definition.type==='guard'&&index%2===0;
    const person={...definition,type:definition.type??'worker',townId:'highmere',factionId:'highmere',externalSchedule:true,actor,position:actor.root.position,home:actor.root.position.clone(),activity:definition.action,clock:0,health:definition.type==='guard'?180:100,maxHp:definition.type==='guard'?180:100,weapon:archer?'weapon.longbow':'sword',archer};
    if(archer){person.role+=' · Archer';person.ammo={ammunition:population.simulation.factions.economy.markets.highmere.stock};}
    person.target={id:person.id,name:person.name,person,kind:'resident',factionId:'highmere',root:actor.root,position:person.position,height:1.3,level:8,hp:person.health,maxHp:person.maxHp,pvp:flagState(),materials:[actor.avatar.materials.skin],flash:0,stagger:0};
    population.residents.push(person);residents.push(person);
    schedule.assign(person,{action:definition.action,work:person.home,stops:HIGHMERE_WORK_CYCLES[definition.id]??(definition.id.startsWith('highmere-market')?[{x:definition.x,z:definition.z,seconds:20,action:'trade',label:'Serving at the market',face:0}]:null),nightShift:definition.nightShift,patrol:patrol.map((_,i)=>patrol[(i+index)%patrol.length]),output:definition.action==='saw'?'arrow.wood':definition.action==='sew'?'linen':definition.action==='hammer'?'iron':definition.action==='gather'?'herbs':'bread',meal:new THREE.Vector3(889+(index%3),0,-799+(index%4))});
  }
  const visitors=population.residents.filter(p=>p.data?.homeTown==='highmere');
  for(const [i,p]of visitors.entries()){p.useExistingRoutine=true;schedule.assign(p,{work:p.home,action:'read',bedIndex:residents.length+i,meal:new THREE.Vector3(889+i%3,0,-799+i%4)});}
  let time=save.cityTime??0;
  const persist=()=>{save.cityTime=time;save.cityResidents=residents.map(p=>({id:p.id,hp:p.target.hp,respawnAt:p.respawnAt}));};
  for(const saved of save.cityResidents??[]){const p=residents.find(p=>p.id===saved.id);if(p&&saved.hp<=0&&saved.respawnAt>Date.now()){p.target.hp=0;p.respawnAt=saved.respawnAt;population.corpses.kill(p.target,Date.now());}}
  await renderer?.compileAsync(root,camera,scene);root.visible=true;
  return {root,residents,details,schedule,fort,save:persist,update(dt,player){
    time+=dt;schedule.tick(dt);town.update(player);details.update(player);fort.update(time);trees.update(camera);
    let rebuild=false;
    for(const gate of fort.gates){const state=world.townLife.defence.gate('highmere',gate.id);gate.update(state,dt);
      if(Boolean(state.closed)!==Boolean(gate.blocking)){gate.blocking=state.closed;rebuild=true;if(state.closed){colliders.push(gate.collider);world.extraColliders.push(gate.collider);}else {colliders.splice(colliders.indexOf(gate.collider),1);const i=world.extraColliders.indexOf(gate.collider);if(i>=0)world.extraColliders.splice(i,1);}}
    }
    if(rebuild)population.navigation.add('highmere',colliders,HIGHMERE,170);
    for(const person of residents){
      if(person.target.hp<=0){person.respawnAt??=Date.now()+45000;if(Date.now()>=person.respawnAt){population.corpses.restore(person.target);population.blood.clear(person.target);person.target.hp=person.target.maxHp;person.respawnAt=null;person.position.copy(person.home);}else continue;}
      const distance=person.position.distanceTo(player);person.actor.root.visible=distance<150;
      const start=person.position.clone();let pose=schedule.update(person,dt);
      if(!pose)pose={speed:0,armed:false,activity:'rest'};
      if(person.household&&person.daily.mode==='work'&&!person.intent){updateHousehold(person,dt,{population,player,height:terrainHeight});continue;}
      if(!person.sleeping){person.position.y=terrainHeight(person.position.x,person.position.z);updateFacing(person,dt);}
      const speed=person.sleeping?0:Math.hypot(person.position.x-start.x,person.position.z-start.z)/Math.max(dt,.001);
      pose.speed=speed;pose.weaponId=person.weapon;person.actualSpeed=speed;person.audioState={...pose,weapon:person.weapon,jobTime:person.actor.jobs.time};
      person.poseTime=(person.poseTime??0)+dt;
      if(distance<150&&person.poseTime>=(person.sleeping?1:distance<16?1/45:distance<50?1/18:1/6)){
        person.actor.update(Math.min(.15,person.poseTime),pose);person.poseTime=0;
      }
      schedule.poseSleep(person);
    }
  },trees,stats(){return {namedNPCs:residents.length,working:residents.filter(p=>p.daily.mode==='work').length,sleeping:residents.filter(p=>p.sleeping).length,guardsOnDuty:residents.filter(p=>p.type==='guard'&&p.daily.mode==='patrol').length,citySeconds:time};},dispose(){
    persist();unregisterGates?.();unregisterLamps();town.dispose();details.dispose();trees.dispose();stations.dispose();for(const station of stations.stations)world.workstations.stations.splice(world.workstations.stations.indexOf(station),1);
    for(const p of visitors){schedule.wake(p);p.scheduleOwner=null;p.daily=null;}
    for(const person of residents){population.corpses.restore(person.target);population.residents.splice(population.residents.indexOf(person),1);person.actor.dispose();}
    for(const collider of colliders){const i=world.extraColliders.indexOf(collider);if(i>=0)world.extraColliders.splice(i,1);}population.navigation.remove('highmere');fort.dispose();root.removeFromParent();
  }};
}
