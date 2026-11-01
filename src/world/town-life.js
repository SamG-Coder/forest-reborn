import * as THREE from 'three';
import {CAMP_DEFINITIONS,CampDirector} from './camp-director.js';
import {createSettlementDetails} from './settlement-details.js';
import {DailySchedule} from '../npc/daily-schedule.js';
import {TOWN_PLOTS} from './layout.js';
import {createHumanoid} from '../npc/humanoid.js';
import {createHairSystem} from '../hair/system.js';
import {GOBLIN_SCALE,goblinOutfit} from '../npc/goblin.js';
import {changeStanding} from '../factions/catalog.js';
import {trunkObstacles} from './vegetation-placement.js';
import {TownDefence} from './town-defence.js';
import {prepareExpedition,expeditionState} from './camp-expeditions.js';
import {FIELD_ENEMIES} from '../npc/field-roster.js';
import {yieldJob} from './async-jobs.js';

export async function createTownLife({scene,world,population,progress,template,registry,materials,player,message}){
  const details=createSettlementDetails(scene,{plots:TOWN_PLOTS,materials:world.materials,timber:world.forest.textures.timber,dayNight:world.dayNight});
  world.extraColliders.push(...details.colliders);
  population.navigation.add('mosswake',[...world.buildings,...trunkObstacles()],{x:0,z:0},150);
  const schedule=new DailySchedule({clock:world.dayNight.clock,population,details,townId:'mosswake'});
  const residentNames=['Silas','Wren','Cedric','Jory'];let guardIndex=0;
  for(const person of population.residents){
    if(person.externalSchedule||person.data?.homeTown==='highmere')continue;
    person.useExistingRoutine=true;
    if(person.type==='guard'){person.name=residentNames[guardIndex++];person.target.name=person.name;}
    const job=person.routine?.goal;
    schedule.assign(person,{work:person.home,action:job?.action??(person.type==='patron'?'drink':'read'),patrol:person.routine?.stops?.map(s=>new THREE.Vector3(s.x,0,s.z)),nightShift:person.type==='guard'&&guardIndex>2,meal:person.type==='patron'?person.home:new THREE.Vector3(-19+schedule.people.length%4,0,-14),output:person.id==='smith'?'iron':person.id==='herbalist'?'herbs':'bread'});
  }
  population.dailySchedule=schedule;
  const director=new CampDirector(progress.data.realm.camps??={}),owned=[],campProps=[];
  const defence=new TownDefence(progress.data.realm.defences??={},population.simulation.factions.economy),townGates=new Map();
  const groups=new Map(CAMP_DEFINITIONS.map(c=>[c.id,[]]));
  for(const target of population.targets.filter(t=>['goblin','bandit'].includes(t.kind))){
    const def=CAMP_DEFINITIONS.filter(c=>c.town==='mosswake'&&c.kind===target.kind).sort((a,b)=>Math.hypot(a.x-target.position.x,a.z-target.position.z)-Math.hypot(b.x-target.position.x,b.z-target.position.z))[0];
    target.campId=def.id;groups.get(def.id).push(target);
  }
  // Highmere's distant camps load actors only while the northern region is nearby.
  let loading=false;const loadedCamps=new Set();
  async function loadCityCamps(){
    if(loading)return;loading=true;
    try{for(const def of CAMP_DEFINITIONS.filter(c=>c.town==='highmere'&&!loadedCamps.has(c.id)&&Math.hypot(player.position.x-c.x,player.position.z-c.z)<430)){
      for(let i=0;i<6;i++){
      await yieldJob();
      const kind=def.kind==='shieldbreaker'&&i===5?'hillGiant':def.kind,spec=FIELD_ENEMIES.find(e=>e.kind===kind),goblin=kind==='goblin';
      const actor=await createHumanoid(template,registry,materials,{kind:kind==='hillGiant'?'ogre':kind,skin:spec?.skin??(goblin?'#839962':'#ba9578'),scale:spec?.scale??(goblin?GOBLIN_SCALE:1),outfit:spec?.outfit??(goblin?goblinOutfit(i):['clothes.traveller-red','legs.starter'])});
      scene.add(actor.root);const angle=i*Math.PI/3,x=def.x+Math.sin(angle)*5,z=def.z+Math.cos(angle)*5;actor.root.position.set(x,world.height(x,z),z);
      if(!goblin&&kind!=='hillGiant'){const hair=await createHairSystem(actor.avatar,template.gearTemplates.helmet);hair.setStyle(i%2?'shaggy':'short');hair.setColor('#433027');hair.setHeadwear(actor.wardrobe.entries.get('head')?.definition);}
      const target={id:def.id+'-'+i,campId:def.id,zoneId:def.id,kind,factionId:def.faction,name:spec?.name??(goblin?'Thicket goblin':'Ridge bandit'),level:spec?.level??(goblin?5:6),weapon:spec?.weapon??(goblin?'unarmed':'sword'),damage:spec?.damage,root:actor.root,position:actor.root.position,home:actor.root.position.clone(),controller:actor,height:goblin?.88:kind==='hillGiant'?2.6:1.25,hp:spec?.hp??110,maxHp:spec?.hp??110,hostile:true,materials:[actor.avatar.materials.skin],flash:0,stagger:0,attackTime:0,windup:0};
      groups.get(def.id).push(target);population.targets.push(target);world.targets.push(target);owned.push(target);
    }loadedCamps.add(def.id);}}finally{loading=false;}
  }
  // Fire rings, bedrolls, supply stacks and lookouts make camps legible from the road.
  const wood=new THREE.MeshToonMaterial({map:world.forest.textures.timber,color:'#826444'}),cloth=new THREE.MeshToonMaterial({color:'#75664c',side:THREE.DoubleSide}),stone=world.materials.masonry;
  for(const def of CAMP_DEFINITIONS){
    const root=new THREE.Group();root.name=def.name;root.position.set(def.x,world.height(def.x,def.z),def.z);scene.add(root);
    for(let i=0;i<9;i++){const rock=new THREE.Mesh(new THREE.DodecahedronGeometry(.23),stone);rock.position.set(Math.sin(i/9*Math.PI*2)*.85,.18,Math.cos(i/9*Math.PI*2)*.85);root.add(rock);}
    for(let i=0;i<4;i++){
      const log=new THREE.Mesh(new THREE.CylinderGeometry(.1,.13,1.35,7),wood);log.rotation.z=Math.PI/2;log.rotation.y=i*1.1;log.position.y=.17;root.add(log);
      const bed=new THREE.Mesh(new THREE.BoxGeometry(.8,.13,1.9),cloth);bed.position.set(Math.sin(i*1.57)*4,.07,Math.cos(i*1.57)*4);bed.rotation.y=i*1.57;root.add(bed);
      const tent=new THREE.Mesh(new THREE.ConeGeometry(2.1,2.1,4,1,true),cloth);tent.position.set(Math.sin(i*1.57)*7,1.05,Math.cos(i*1.57)*7);tent.rotation.y=Math.PI/4+i;root.add(tent);
      const crate=new THREE.Mesh(new THREE.BoxGeometry(.8,.7,.8),wood);crate.position.set(2.5+i*.65,.35,-2);root.add(crate);
    }
    const flame=new THREE.Mesh(new THREE.SphereGeometry(.28,8,6),new THREE.MeshBasicMaterial({color:'#ffae54'}));flame.position.y=.43;flame.scale.y=1.4;root.add(flame);
    for(const prop of root.children)prop.position.y+=world.height(def.x+prop.position.x,def.z+prop.position.z)-root.position.y;
    const fixture={root,flame,position:root.position.clone().add(new THREE.Vector3(0,.8,0)),phase:campProps.length};world.dayNight.register([fixture]);campProps.push({root,fixture});
  }
  const notice=document.createElement('section');notice.className='raid-notice';notice.hidden=true;notice.innerHTML='<strong></strong><p></p><button>Help defend the town</button>';document.querySelector('#hud').append(notice);
  notice.querySelector('button').onclick=()=>{const def=nearestRaid();if(!def)return;director.save.camps[def.id].active.helped=true;const raid=api.encounters().find(e=>e.campId===def.id);progress.data.mapPin={name:def.name,place:'Raiding party',x:raid.x,z:raid.z,encounterId:raid.id};message('Follow the raiding party on the map. The watch counts your help when you fight them.',5);};
  function announce(def){
    prepareExpedition(def,director.save.camps[def.id].active,groups.get(def.id));
    defence.raid(def.town,director.save.clock);
    const text=`${def.town==='highmere'?'Highmere':'Mosswake'} watch: ${def.kind==='goblin'?'Goblins':def.faction==='ash'?'Ash soldiers':'Bandits'} are gathering at ${def.name}. Watch the road.`;
    population.simulation.society.announce(text,Date.now());message(text,7);
    const guard=population.residents.find(p=>p.townId===def.town&&p.type==='guard');if(guard)population.living.guardSays(guard,'To the gate! Keep them away from the houses.');
  }
  function nearestRaid(){return CAMP_DEFINITIONS.filter(d=>director.save.camps[d.id].active&&groups.get(d.id).some(t=>t.hp>0&&t.position.distanceTo(player.position)<250)).sort((a,b)=>Math.hypot(player.position.x-a.x,player.position.z-a.z)-Math.hypot(player.position.x-b.x,player.position.z-b.z))[0];}
  function response(person){
    if(person.deployment||person.companion)return null;
    const def=CAMP_DEFINITIONS.find(d=>d.town===person.townId&&director.save.camps[d.id].active);if(!def)return null;
    const enemies=groups.get(def.id).filter(t=>t.campRaid&&t.hp>0),closest=enemies.sort((a,b)=>a.position.distanceToSquared(person.position)-b.position.distanceToSquared(person.position))[0];
    if(!closest)return null;
    const gate=townGates.get(person.townId)?.find(g=>defence.gate(person.townId,g.id).closed);
    if(gate&&person.archer){
      const side=person.id.charCodeAt(person.id.length-1)%2?1:-1;
      const post=gate.position.clone().addScaledVector(gate.normal,-4).addScaledVector(gate.tangent,side*5.2);
      if(person.position.distanceTo(post)>1.5)return {type:'rally',goal:post,label:'Taking an archery post'};
      return {type:'fight',target:closest};
    }
    const fighter=person.type==='guard'||person.id==='captain'||/smith|porter|marshal/.test(person.id)||person.type==='adventurer';
    if(fighter&&closest.position.distanceTo(person.position)<35)return {type:'fight',target:closest};
    if(fighter)return {type:'rally',goal:{x:def.gate[0]+(person.phase??0)%4-2,z:def.gate[1]},label:'Answering the town alarm'};
    return {type:'flee',goal:person.daily?.bed?.home.inside??person.home,label:'Sheltering from the raid'};
  }
  let scan=0;
  const api={director,defence,townGates,details,schedule,groups,response,registerGates(town,gates){townGates.set(town,gates);return ()=>townGates.delete(town);},recordHit(target,attacker,damage){
    if(target.campId){director.hit(target.campId,damage,attacker.id==='player');if(attacker.id==='player'){target.lootClaim='player';target.claimUntil=Date.now()+60000;}}
  },recordDeath(target){if(target.campId)director.loss(target.campId);},forceRaid(){
    const town=Math.hypot(player.position.x-850,player.position.z+850)<400?'highmere':'mosswake';
    const def=CAMP_DEFINITIONS.find(d=>d.town===town&&groups.get(d.id).filter(t=>t.hp>0).length>=3&&!director.save.camps[d.id].active);if(!def)return false;
    const raid=director.start(def.id,{forced:true,strength:groups.get(def.id).filter(t=>t.hp>0).length});if(raid)announce(def);return Boolean(raid);
  },update(dt){
    details.update(player.position);schedule.tick(dt);
    loadCityCamps().catch(e=>{console.error(e);});
    director.update(dt,{night:world.dayNight.clock.night,nearby:def=>Math.hypot(player.position.x-def.x,player.position.z-def.z)<300,available:id=>groups.get(id).filter(t=>t.hp>0&&!t.dormant).length,demand:id=>population.simulation.factions.economy.demand(id,'bread'),onStart:announce});
    for(const [town,gates]of townGates){
      const underAttack=CAMP_DEFINITIONS.some(d=>d.town===town&&director.save.camps[d.id].active);
      defence.update(town,gates.map(g=>g.id),{now:director.save.clock,night:world.dayNight.clock.night,underAttack});
      for(const gate of gates)if(defence.gate(town,gate.id).closed&&gate.position.distanceTo(player.position)<9&&!underAttack){
        if(defence.passage(town,gate.id,director.save.clock,false))message('The watch raises the gate to let you through.',3);
      }
    }
    for(const def of CAMP_DEFINITIONS){
      const c=director.save.camps[def.id],members=groups.get(def.id),raid=c.active,near=members.some(t=>t.hp>0&&t.position.distanceTo(player.position)<420);
      const expedition=raid?expeditionState(def,raid,members,director.save.clock):null;
      if(expedition?.phase==='raiding')raid.reachedTown=true;
      const roster=new Set(expedition?.alive.map(t=>t.id));
      // Active expeditions retain their journey across streamed regions. Far away,
      // their movement is updated once a second rather than animating every frame.
      c.travelTime=(c.travelTime??0)+dt;const step=near?dt:c.travelTime>=1?c.travelTime:0;if(step)c.travelTime=0;
      for(const [index,t]of members.entries()){
        t.campRaid=roster.has(t.id)?def:null;
        t.attackingGate=false;
        if(t.hp<=0||!step||(!near&&!raid)||t.engagedUntil>Date.now()&&expedition?.phase!=='withdrawing')continue;
        if(t.campRaid){
          const entry=townGates.get(def.town)?.slice().sort((a,b)=>Math.hypot(a.position.x-def.gate[0],a.position.z-def.gate[1])-Math.hypot(b.position.x-def.gate[0],b.position.z-def.gate[1]))[0];
          const atEntry=raid.waypoint===raid.route.length-1&&raid.phase!=='withdrawing';
          const gate=atEntry&&entry&&defence.gate(def.town,entry.id).closed?entry:null;
          const angle=index*2.399,waypoint=expedition.goal??raid.route[0],goal=gate?gate.position.clone().addScaledVector(gate.normal,2).addScaledVector(gate.tangent,(index-2.5)*1.5):new THREE.Vector3(waypoint.x+Math.sin(angle)*2,0,waypoint.z+Math.cos(angle)*2);
          t.raidRetreating=raid.phase==='withdrawing';
          if(t.raidRetreating){t.combatTarget=null;t.engagedUntil=0;}
          t.moveSpeed=population.move(t,goal,step,raid.phase==='forming'?1.05:2.7);t.moving=t.moveSpeed>.05;t.activity=gate?'Attacking the gate':raid.phase==='withdrawing'?'Returning to '+def.name:raid.phase==='forming'?'Gathering the raiding party':'Marching from '+def.name;
          t.attackingGate=Boolean(gate&&Math.hypot(t.position.x-goal.x,t.position.z-goal.z)<2.5);
          if(t.attackingGate){t.desiredYaw=Math.atan2(gate.position.x-t.position.x,gate.position.z-t.position.z);t.windup=Math.max(0,(t.windup??0)-dt);
            if(director.save.clock>=(t.nextGateHit??0)){defence.damage(def.town,gate.id,24);t.nextGateHit=director.save.clock+1.7;t.windup=.65;t.attackDuration=.65;t.strikes=(t.strikes??0)+1;}
          }
        }
        else {
          const beat=Math.floor(director.save.clock/20)+index,role=index%4,angle=beat*.75+index*1.9;
          const goal=role===0?new THREE.Vector3(def.x+Math.sin(angle)*11,0,def.z+Math.cos(angle)*11):t.home;
          t.raidRetreating=false;t.moveSpeed=population.move(t,goal,step,1.05);t.moving=t.moveSpeed>.05;t.activity=world.dayNight.clock.night&&role!==0?'Resting at camp':['Keeping watch','Training','Cooking','Sorting supplies'][role];t.jobActivity=t.moving?'rest':world.dayNight.clock.night&&role!==0?'rest':['watch','hammer','cook','sort'][role];
        }
        t.position.y=world.height(t.position.x,t.position.z);
      }
      if(raid){const alive=expedition.alive.length;
        if(expedition.finished){const reward=director.finish(def.id,expedition.repelled);members.forEach(t=>{t.campRaid=null;t.raidRetreating=false;t.pathGoal=null;t.combatTarget=null;});
          if(raid.contribution>0&&expedition.repelled)progress.recordObjective('defend:'+(def.id==='cart-camp'?'cart-road-raid':def.id));
          if(reward){progress.data.coins+=reward.coins;progress.addXP(reward.xp);progress.data.reputation??={};changeStanding(progress.data.reputation,def.town,reward.reputation);progress.recordObjective('defend:'+def.town);progress.save();message(`The watch noticed your help. +${reward.xp} XP · +${reward.coins} copper · +${reward.reputation} ${def.town==='highmere'?'Highmere':'Mosswake'} standing.`,8);}
          if(reward){const memory=defence.town(def.town);memory.helpedByPlayer=(memory.helpedByPlayer??0)+1;const guard=population.residents.find(p=>p.townId===def.town&&p.type==='guard');if(guard)population.living.guardSays(guard,'You stayed when it got rough. We will remember that.');progress.save();}
          else if(near)message(expedition.repelled?'The watch has driven the raiders off.':raid.reachedTown?'The raiders are withdrawing with stolen supplies.':'The raiders have turned back toward camp.',5);
          if(raid.reachedTown&&!expedition.repelled)population.simulation.factions.economy.receive(def.town,'bread',-8);
        }
      }
    }
    scan-=dt;if(scan<=0){scan=.5;const raid=nearestRaid();notice.hidden=!raid;if(raid){const c=director.save.camps[raid.id],live=api.encounters().find(e=>e.campId===raid.id);notice.querySelector('strong').textContent=live?.phase==='withdrawing'?'Raiders withdrawing':live?.phase==='forming'?'Raiders gathering':'Raiding party on the road';notice.querySelector('p').textContent=`${raid.name} · ${live?.members??0} raiders · Your contribution: ${Math.round(c.active.contribution)}`;}}
  },encounters(){return CAMP_DEFINITIONS.flatMap(def=>{const raid=director.save.camps[def.id].active;if(!raid)return [];const members=groups.get(def.id).filter(t=>raid.members?.includes(t.id)&&!raid.fallen?.includes(t.id)&&t.hp>0);if(!members.length)return [];return [{id:raid.id,campId:def.id,name:def.name,phase:raid.phase,members:members.length,x:members.reduce((n,t)=>n+t.position.x,0)/members.length,z:members.reduce((n,t)=>n+t.position.z,0)/members.length,route:raid.route}];});},stats(){return {camps:CAMP_DEFINITIONS.map(d=>({id:d.id,members:groups.get(d.id).length,...director.save.camps[d.id]})),encounters:this.encounters(),sleeping:population.residents.filter(p=>p.sleeping).length};}};
  population.townLife=api;population.living.townLife=api;return api;
}
