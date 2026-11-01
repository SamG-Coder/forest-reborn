import {PEDESTRIAN_SPEED} from '../game/locomotion-speed.js';
import * as THREE from 'three';
import {PlayerProgress} from '../progression/save.js';
import {QUESTS} from '../progression/quests.js';
import {questGuide,questContact} from '../progression/quest-guide.js';
import {RECIPES,craftItem} from '../progression/recipes.js';
import {insertItem,removeItem} from '../progression/inventory.js';
import {GATHERING} from '../progression/skills.js';
import {WORKSTATIONS,HIGHMERE_WORKSTATIONS} from '../world/workstations.js';
import {HIGHMERE_ROADS} from '../world/region-layout.js';
import {terrainHeight} from '../world/terrain.js';
import {wakePose} from '../cinematic/poses.js';
import {weaponAction} from '../game/weapon-catalog.js';
import {seedVeteranJournal} from './regional-adventurers.js';
import {SHOP_OFFERS,shopStock} from '../progression/shop.js';
import {VENDORS} from '../factions/catalog.js';

const northRoad=HIGHMERE_ROADS.find(r=>r.points[0][0]===4).points;
const idle=activity=>({speed:0,action:null,armed:false,seated:false,activity});

export function organiseQuestParties(population){
  const people=population.residents.filter(p=>p.data?.journey?.phase==='quests'&&!p.companion&&p.target.hp>0);
  for(const leader of people){
    const j=leader.data.journey,q=QUESTS.find(q=>q.id===j.quest);
    j.party=j.party?.filter(id=>people.some(p=>p.data.id===id&&p.data.journey.quest===j.quest));
    if(!q||j.party?.length>1||!['main','faction'].includes(q.type))continue;
    const others=people.filter(p=>p!==leader&&!p.data.journey.party?.length&&p.data.journey.quest===q.id&&p.position.distanceTo(leader.position)<30).slice(0,4);
    if(!others.length)continue;
    const members=[leader,...others],ids=members.map(p=>p.data.id);
    for(const member of members)member.data.journey.party=ids;
    const society=population.simulation.society;
    if((j.completed??0)>=2){
      const guild=society.guildFor(leader.data.id)??society.createGuild('Roadward Company '+(leader.data.id+1),leader.data.id);
      if(guild)for(const member of others)if(!society.guildFor(member.data.id))society.join(member.data.id,guild.id);
    }
    population.simulation.record(leader.data,'party','formed a group for '+q.title);
  }
}

/** An adventurer's journal uses the player's quest definitions, gates, costs
 * and rewards. Every objective still needs a real world action and location. */
export class QuestJourney {
  constructor(person,population,registry){
    this.person=person;this.population=population;this.actor=person.data;
    this.registry=registry;this.work=0;this.clock=0;
    const data=this.actor;
    this.progress=new PlayerProgress({getItem:()=>data.questProgress?JSON.stringify(data.questProgress):null,setItem:(_,value)=>{data.questProgress=JSON.parse(value);}},registry);
    this.progress.data.coins=data.coins;this.progress.data.skills=data.skills;
    this.progress.ownerId=person.id;
    if(data.homeTown==='highmere')seedVeteranJournal(data,this.progress,[...person.actor.wardrobe.entries.values()].map(e=>e.definition.id));
    data.journey??={phase:'waiting',arrivalDelay:data.id*9,age:0};
    population.simulation.questAgents??=new Map();population.simulation.questAgents.set(data.id,this);
  }
  record(kind,amount=1){this.progress.recordObjective(kind,amount);}
  defeated(target){this.progress.recordKill(target.kind);}
  syncIn(){
    const p=this.progress,d=this.actor;p.data.coins=d.coins;p.data.skills=d.skills;
    p.data.bag=p.data.bag.map(s=>s&&p.item(s.id).type==='Material'?null:s);
    for(const [id,count]of Object.entries(d.inventory))p.data.bag=insertItem(p.data.bag,id,count,p.item(id).stack)??p.data.bag;
    Object.assign(p.data.worldFlags,this.population.simulation.factions.progress?.data.worldFlags??{});
  }
  syncOut(){
    this.progress.save();this.actor.coins=this.progress.data.coins;this.actor.inventory={...this.progress.data.inventory};this.actor.skills=this.progress.data.skills;
    this.actor.weapon=this.progress.data.weapon;
  }
  walk(goal,dt,label){
    const person=this.person,pos=person.position;
    const j=this.actor.journey;j.travelGoal={x:goal.x,z:goal.z};
    let waypoint=goal,pace=Math.hypot(goal.x-pos.x,goal.z-pos.z)>40?PEDESTRIAN_SPEED.run:PEDESTRIAN_SPEED.walk;
    if(Math.hypot(goal.x-pos.x,goal.z-pos.z)>200){
      const north=goal.z<pos.z,path=north?northRoad:[...northRoad].reverse();
      const candidates=path.filter(([x,z])=>north?z<pos.z-8:z>pos.z+8);
      if(candidates.length)waypoint={x:candidates[0][0],z:candidates[0][1]};
    }
    const party=(j.party??[]).map(id=>this.population.simulation.questAgents?.get(id)?.person).filter(Boolean),leader=party[0];
    const following=leader&&leader!==person&&leader.data.journey.travelGoal;
    if(following&&Math.hypot(following.x-goal.x,following.z-goal.z)<5){
      const gap=leader.position.distanceTo(pos),slot=party.indexOf(person),yaw=leader.actor.root.rotation.y;
      if(gap>4&&gap<60&&Math.hypot(goal.x-pos.x,goal.z-pos.z)>12)waypoint={x:leader.position.x-Math.sin(yaw)*2+Math.cos(yaw)*(slot%2?1.5:-1.5),z:leader.position.z-Math.cos(yaw)*2-Math.sin(yaw)*(slot%2?1.5:-1.5)};
    }else if(leader===person&&party.some(p=>p!==person&&p.position.distanceTo(pos)>14))pace=Math.min(pace,1.8);
    const point=new THREE.Vector3(waypoint.x,0,waypoint.z),speed=this.population.move(person,point,dt,pace);
    person.activity=label;this.actor.activity=label;return {...idle('rest'),speed};
  }
  at(goal,radius=2.2){return Math.hypot(this.person.position.x-goal.x,this.person.position.z-goal.z)<radius;}
  workAt(goal,dt,label,duration,action,done){
    const key=label+':'+goal.x+':'+goal.z;if(this.workKey!==key){this.workKey=key;this.work=0;}
    if(!this.at(goal,goal.kind?1.8:goal.id?3.3:2.2)){this.work=0;return this.walk(goal,dt,label);}
    if(goal.id){const contact=this.population.residents.find(p=>p.id===goal.id);if(contact)contact.npcTalkingUntil=Date.now()+4000;}
    this.person.activity=label;this.work+=dt;
    if(this.work>=duration){this.work=0;done();this.syncOut();}
    return idle(action);
  }
  obtain(id,count,dt,depth=0){
    if(depth>5)return null;
    const p=this.progress,recipe=RECIPES.find(r=>r.output===id),resources=this.population.resources;
    if(recipe){
      for(const [part,n]of Object.entries(recipe.ingredients))if(!p.hasItem(part,n))return this.obtain(part,n,dt,depth+1);
      if((p.data.skills[recipe.skill]?.level??1)<(recipe.minLevel??1)){
        const training=RECIPES.find(r=>r.skill===recipe.skill&&(r.minLevel??1)<=p.data.skills[recipe.skill].level);
        if(training&&training!==recipe)return this.obtain(training.output,(p.data.inventory[training.output]??0)+1,dt,depth+1);
        return null;
      }
      const stations=[...WORKSTATIONS,...HIGHMERE_WORKSTATIONS].filter(s=>s.id===recipe.station).sort((a,b)=>Math.hypot(a.x-this.person.position.x,a.z-this.person.position.z)-Math.hypot(b.x-this.person.position.x,b.z-this.person.position.z));
      return this.workAt(stations[0],dt,'Making '+p.item(id).name,recipe.duration,recipe.animation,()=>craftItem(p,recipe));
    }
    const gather=GATHERING[id];
    if(gather){
      if(gather.tool&&!p.hasItem(gather.tool))return this.obtain(gather.tool,1,dt,depth+1);
      const node=resources.available().filter(n=>n.kind===id&&n.remaining>0).sort((a,b)=>Math.hypot(a.x-this.person.position.x,a.z-this.person.position.z)-Math.hypot(b.x-this.person.position.x,b.z-this.person.position.z))[0];
      if(node)return this.workAt(node,dt,'Gathering '+p.item(id).name,gather.duration??3,gather.animation??'gather',()=>{const kind=resources.harvest(node.id,this.person.position,Date.now());if(kind){p.addItem(kind,gather.yield??1);p.recordObjective('gather:'+kind,gather.yield??1);p.addSkillXP(gather.skill,gather.xp);}});
      return null;
    }
    const prey={rabbitHide:'rabbit',linen:'bandit',goblinScrap:'goblin',steelScrap:'ashRaider',ogreTooth:'ogre',giantRune:'hillGiant'}[id];
    if(prey)return this.hunt(prey,dt);
    const economy=this.population.simulation.factions.economy;
    const vendor=Object.entries(SHOP_OFFERS).filter(([key,offers])=>VENDORS[key]&&offers.some(o=>o[0]===id)).map(([key,offers])=>({key,...VENDORS[key],offer:offers.find(o=>o[0]===id)})).sort((a,b)=>Math.hypot(a.x-this.person.position.x,a.z-this.person.position.z)-Math.hypot(b.x-this.person.position.x,b.z-this.person.position.z))[0];
    if(!vendor)return null;
    const price=economy.quote(vendor.key,id,p.item(id).value,'buy')*count;
    if(p.data.coins<price)return null;
    return this.workAt({id:vendor.key,x:vendor.x,z:vendor.z},dt,'Buying '+p.item(id).name,2,'trade',()=>{
      const ledger=this.population.simulation.shopStock;if(shopStock(ledger,vendor.key,vendor.offer,economy)<count)return;
      if(p.addItem(id,count)){p.data.coins-=economy.purchase(vendor.key,id,count,p.item(id).value);ledger[vendor.key+':'+id]-=count;if(p.item(id).type==='Tool')this.actor.tools[id]=true;}
    });
  }
  regionalJob(dt){
    const data=this.actor,j=data.journey,p=this.progress,board=this.population.simulation.factions.jobs;
    if(data.homeTown!=='highmere'||data.id%3===0)return null;
    let job=board.orders.find(o=>o.id===j.job&&o.status==='active');
    if(!job&&this.clock<.05){
      const contacts=this.population.residents.filter(n=>n.townId==='highmere'&&n.type!=='adventurer'&&n.target.hp>0);
      const giver=contacts[(data.id+(j.jobsDone??0))%contacts.length];
      if(giver){job=board.forPerson(giver,Date.now(),this.person.id).find(o=>o.status==='available');if(job&&board.accept(job.id,p))j.job=job.id;else job=null;}
    }
    if(!job)return null;
    const giver=this.population.residents.find(n=>n.id===job.giver);if(!giver)return null;
    if(p.hasItem(job.item,job.count))return this.workAt({id:giver.id,x:giver.position.x,z:giver.position.z},dt,'Delivering supplies to '+giver.name,3,'carry',()=>{if(board.complete(job.id,p)){j.jobsDone=(j.jobsDone??0)+1;j.job=null;this.population.simulation.record(data,'job','supplied '+giver.name+' with '+job.count+' '+p.item(job.item).name);}});
    return this.obtain(job.item,job.count-(p.data.inventory[job.item]??0),dt);
  }
  hunt(kind,dt){
    const leader=this.population.residents.find(p=>p.data?.id===this.actor.journey.party?.[0]);
    const target=(leader?.preyId&&this.population.targets.find(t=>t.id===leader.preyId&&t.hp>0&&t.kind===kind))??this.population.targets.filter(t=>t.hp>0&&t.kind===kind).sort((a,b)=>a.position.distanceToSquared(this.person.position)-b.position.distanceToSquared(this.person.position))[0];
    if(!target)return null;this.person.preyId=target.id;
    if(target.position.distanceTo(this.person.position)>24)return this.walk(target.position,dt,'Hunting '+target.name);
    this.person.intent={type:'fight',target};return this.population.living.behaviour(this.person,dt,Date.now());
  }
  update(dt){
    const person=this.person,data=this.actor,j=data.journey;j.age+=dt;this.clock+=dt;
    if(j.phase==='waiting'){
      person.actor.root.visible=false;
      if(j.age<j.arrivalDelay)return idle('rest');
      j.phase='arrival';j.age=0;person.position.set(-8+(data.id%4)*1.7,0,5+Math.floor(data.id/4)*1.6);person.position.y=terrainHeight(person.position.x,person.position.z);
      this.population.living.guardSays(person,'Where am I? This was a road a moment ago.');
    }
    if(j.phase==='arrival'){
      person.activity='Waking in Mosswake';person.actor.animator.update(dt,{speed:0,weapon:'unarmed'});wakePose(person.actor.avatar,j.age,.94);
      person.actor.root.visible=true;person.arrivalPose=true;
      if(j.age>=12){j.phase='quests';person.arrivalPose=false;this.population.simulation.record(data,'arrival','woke in Mosswake and went to find Tomas');}
      return idle('rest');
    }
    person.arrivalPose=false;
    if(this.clock>=1){this.clock=0;this.syncIn();}
    if(person.talkingUntil>Date.now()||person.npcTalkingUntil>Date.now()){person.activity='Talking';return idle('trade');}
    const contractWork=this.population.contracts?.task(this,dt);if(contractWork)return contractWork;
    const jobWork=this.regionalJob(dt);if(jobWork)return jobWork;
    const p=this.progress;
    if(data.id%4===2&&p.data.quests.errand?.completed){
      if(!weaponAction(p.data.weapon).ranged){
        const index=p.data.bag.findIndex(s=>s?.id==='weapon.shortbow');
        if(index>=0){p.equipItem(index);this.syncOut();}
        else {const work=this.obtain('weapon.shortbow',1,dt);if(work)return work;}
      }else if(!p.hasItem('arrow.wood',6)){
        const work=this.obtain('arrow.wood',12,dt);if(work)return work;
      }
    }
    let quest=QUESTS.find(q=>q.id===j.quest);
    if(!quest||['completed','locked'].includes(p.state(quest))){
      j.party=[];
      const choices=QUESTS.filter(q=>p.state(q)==='available');
      const score=q=>(q.type==='main'?4:0)+(data.homeTown==='highmere'&&q.giver.startsWith('highmere')?12:0)+(data.id%3&&j.completed%3===1&&/craft:|gather:/.test(q.kind)?6:0);
      choices.sort((a,b)=>score(b)-score(a));
      quest=choices[0];j.quest=quest?.id;
    }
    if(!quest)return null;
    const status=p.state(quest),guide=questGuide(quest,p,this.population);
    if(status==='available'||status==='ready'){
      const contact=status==='ready'?guide.turnIn:guide.giver;
      return this.workAt(contact,dt,(status==='ready'?'Reporting to ':'Speaking with ')+contact.name,3,'read',()=>{
        if(status==='available'){p.accept(quest.id);this.population.simulation.record(data,'quest','accepted '+quest.title);}
        else{const reward=p.claim(quest.id);if(reward){this.population.simulation.record(data,'quest','completed '+quest.title);data.xp+=reward.xp;
          const factions=this.population.simulation.factions;
          if(quest.kind.startsWith('deliver:'))factions.economy.receive(quest.faction,quest.kind.slice(8),quest.count);
          // Personal audiences and reputation stay in this journal. Supplies
          // and repaired roads change the same world everyone travels through.
          for(const key of ['tavernSupplied','roadWatch','caravanOpen','beaconLit','northRoadRecovered'])if(quest.worldChanges?.[key]){
            factions.flags??={};factions.flags[key]=true;if(factions.progress)factions.progress.data.worldFlags[key]=true;
          }
          const id=reward.weapon??reward.item;if(id){const i=p.data.bag.findIndex(s=>s?.id===id);if(p.item(id).slot&&i>=0){p.equipItem(i);person.actor.wardrobe.apply(p.data.equipped);}}j.completed=(j.completed??0)+1;j.quest=null;j.party=[];}}
      });
    }
    if(quest.kind==='parcel')return this.workAt({id:'trader',x:10,z:4.2},dt,'Collecting Tomas’s flour',2,'carry',()=>{if(p.addItem('flour'))p.recordObjective('parcel');});
    if(quest.kind.startsWith('talk:'))return this.workAt(questContact(quest.kind.slice(5),this.population),dt,guide.objective,3,'read',()=>p.recordObjective(quest.kind));
    if(quest.kind.startsWith('deliver:')){const id=quest.kind.slice(8);return this.obtain(id,Math.max(1,quest.count-(p.data.inventory[id]??0)),dt);}
    if(quest.kind.startsWith('craft:'))return this.obtain(quest.kind.slice(6),1,dt);
    if(quest.kind.startsWith('gather:'))return this.obtain(quest.kind.slice(7),1,dt);
    if(quest.kind==='restore:beacon'){
      if(!p.hasItem('ironIngot',3))return this.obtain('ironIngot',3,dt);if(!p.hasItem('wood',6))return this.obtain('wood',6,dt);
      return this.workAt({x:8,z:-59},dt,'Repairing the road beacon',5,'hammer',()=>{p.data.bag=removeItem(removeItem(p.data.bag,'ironIngot',3),'wood',6);p.recordObjective(quest.kind);});
    }
    if(quest.kind.startsWith('battle:')||quest.kind.startsWith('defend:')){
      const director=this.population.battleDirector,id=quest.kind.split(':')[1],state=director?.state(id);
      if(state?.status==='resolved'&&j.attended===id){p.recordObjective(quest.kind);this.syncOut();return idle('rest');}
      if(state?.status==='active'){
        if(this.at({x:guide.x,z:guide.z},55)){j.attended=id;this.person.activity='Holding with the reserves';}
        const unit=this.population.targets.find(t=>t.zoneId===id&&t.hp>0&&t.team===0);
        if(unit){j.attended=id;return this.walk(unit.position,dt,'Joining the company');}
      }
      return this.walk({x:guide.x,z:guide.z},dt,'Travelling to the muster');
    }
    return this.hunt(quest.kind,dt);
  }
}
