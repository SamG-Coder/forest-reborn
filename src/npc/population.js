import {createMeadowRabbits,updateWildlife} from './wildlife.js';
import {GOBLIN_SCALE,GOBLIN_SKINS,goblinOutfit} from './goblin.js';
import {GATHERING} from '../progression/skills.js';
import {LivingWorld} from './living-world.js';
import {chooseActivity} from './society.js';
import {buyAxeForActor} from '../progression/shop.js';
import * as THREE from 'three';
import {createHumanoid} from './humanoid.js';
import {createHairSystem} from '../hair/system.js';
import {encodeVariant,variantItemIds} from '../gear/variants.js';
import {QUEST_GIVERS} from '../progression/quests.js';
import {terrainHeight} from '../world/terrain.js';
import {NavigationAreas} from '../world/navigation-areas.js';
import {JOB_ROUTES,JobRoutine,guardRoute} from './routines.js';
import {trunkObstacles} from '../world/vegetation-placement.js';
import {TASK_LABELS} from './simulation.js';
import {SkillAction} from '../game/skill-action.js';
import {SWORD_CUT_COUNT,SWORD_DURATION,SWORD_IMPACT} from '../game/sword-motion.js';
import {inAttackRange} from '../game/targeting.js';
import {separatePosition} from './combat-approach.js';
import {facePoint,updateFacing,arrivedAt} from './motion.js';

const clamp=THREE.MathUtils.clamp;
const TRAVEL_LABELS={hunt:'Heading out to hunt',gather:'Walking to gather supplies',sell:'Taking supplies to Orin',tavern:'Walking to the tavern',rest:'Finding a place to rest',train:'Walking to practise',buyTool:'Going to buy an axe',explore:'Exploring the countryside'};
function outfit(seed,outer='none'){
  return variantItemIds(encodeVariant({dye:['blue','green','rust','ivory','violet','slate'][seed%6],metal:'iron',leather:seed%2?'black':'brown',outer,
    states:{frontPanel:false,backPanel:false,helmet:outer==='plate',necklace:false,ringLeft:false,ringRight:false,trim:seed%3===0}}));
}
export async function createPopulation(scene,template,registry,materials,simulation,obstacles=[],resources){
  const residents=[],targets=[],all=[];
  const navigation=new NavigationAreas([...obstacles,...trunkObstacles()]);
  async function human(options){
    const actor=await createHumanoid(template,registry,materials,options);scene.add(actor.root);all.push(actor);return actor;
  }
  async function resident(info,index,outer='none'){
    const actor=await human({bodyType:info.gender==='female'||info.type==='adventurer'&&index%3===0?'female':'male',outfit:outfit(index,outer),skin:['#dbaf8d','#b68a6b','#edc5a5','#d3a884','#b2947e'][index%5],face:index%5,scale:.96+(index%4)*.026,build:.94+(index%5)*.035});
    actor.root.position.set(info.x,terrainHeight(info.x,info.z),info.z);actor.root.rotation.y=info.yaw??0;
    const hair=await createHairSystem(actor.avatar,template.gearTemplates.helmet);hair.setStyle(actor.avatar.bodyType==='female'?['bob','ponytail','braid','long'][index%4]:['short','swept','shaggy','parted','spiky','undercut'][index%6]);hair.setColor(['#352b29','#60483a','#aaa28a'][index%3]);hair.setHeadwear(actor.wardrobe.entries.get('head')?.definition);
    const person={...info,actor,position:actor.root.position,home:actor.root.position.clone(),phase:index*.8};
    if(JOB_ROUTES[info.id])person.routine=new JobRoutine(JOB_ROUTES[info.id]);
    if(info.type==='guard')person.routine=new JobRoutine(guardRoute(index-3));
    residents.push(person);return person;
  }
  await Promise.all(QUEST_GIVERS.map((info,i)=>resident({...info,type:'quest'},i,i===1?'plate':'none')));
  for(let i=0;i<4;i++)await resident({id:`guard-${i}`,name:`Mosswake guard`,role:'Town watch',type:'guard',x:i%2?7:-7,z:i<2?-43:30,armed:true},i+3,'plate');
  for(const [i,info] of [
    {id:'smith',name:'Garrick',role:'Smith',type:'worker',x:23,z:25.1,greeting:'Mind the sparks. I’ll be with you when this cools.'},
    {id:'herbalist',name:'Ivo',role:'Herbalist',type:'worker',x:-22,z:24.1,greeting:'Those bundles are still drying. The ones on the left are ready.'},
    {id:'vendor',name:'Perrin',role:'Greengrocer',type:'worker',x:-10,z:5,greeting:'Carrots came in this morning. Still have the dirt on them.'},
    {id:'courier',name:'Seth',role:'Courier',type:'worker',x:4,z:0,greeting:'Tavern, market, watch house. Then I can put this bag down.'},
  ].entries())await resident(info,31+i,i===0?'leather':'none');
  const seats=[[-24.65,-16,1],[-21.35,-16,-1],[-16.65,-16,1],[-13.35,-16,-1],[-24.65,-20,1],[-13.35,-20,-1]];
  for(let i=0;i<6;i++)await resident({id:`patron-${i}`,name:['Bram','Ellis','Keir','Luca','Marek','Darin'][i],role:'Traveller',type:'patron',x:seats[i][0],z:seats[i][1],seated:true,yaw:seats[i][2]*Math.PI/2},i+7);
  for(let i=0;i<simulation.actors.length;i++){
    const starts=[[59,61],[73,-71],[36,45],[-16,-14],[2,-34],[9,29],[82,-75],[64,68],[-3,14],[41,49],[5,-12],[-12,-14]];
    const data=simulation.actors[i],start=starts[i%starts.length];await resident({id:`adventurer-${i}`,name:data.name,role:'Adventurer',type:'adventurer',data,x:start[0],z:start[1],activity:data.task,intentUntil:0},i+13,i%4===0?'leather':'none');
  }
  for(let i=0;i<10;i++){
    const kind=i<6?'goblin':'bandit',index=i<6?i:i-6,x=kind==='goblin'?78+(index%3)*5:-96+(index%2)*6,z=kind==='goblin'?-78-Math.floor(index/3)*6:-105-Math.floor(index/2)*8;
    const actor=await human({kind,outfit:kind==='goblin'?goblinOutfit(index):outfit(i,'leather'),skin:kind==='goblin'?GOBLIN_SKINS[index%GOBLIN_SKINS.length]:'#b9957a',scale:kind==='goblin'?GOBLIN_SCALE:1});
    actor.root.position.set(x,terrainHeight(x,z),z);
    if(kind==='bandit'){const hair=await createHairSystem(actor.avatar,template.gearTemplates.helmet);hair.setStyle('shaggy');hair.setColor('#45352c');}
    const hp=kind==='goblin'?60:95;
    targets.push({id:`${kind}-${index}`,name:kind==='goblin'?'Briar goblin':'Road bandit',kind,level:kind==='goblin'?2:4,root:actor.root,position:actor.root.position,home:actor.root.position.clone(),height:kind==='goblin'?.88:1.25,maxHp:hp,hp,materials:[actor.avatar.materials.skin],flash:0,stagger:0,respawn:0,attackTime:0,windup:0,hostile:true,controller:actor});
  }
  targets.push(...createMeadowRabbits(scene,navigation));
  for(const [i,spec]of [
    ...Array.from({length:6},(_,i)=>({kind:'bandit',x:100+i%3*5,z:-13-Math.floor(i/3)*7,scale:1,level:4,hp:95,name:'East-road bandit'})),
    {kind:'ogre',x:111,z:-96,scale:1.6,level:6,hp:380,name:'Quarry ogre'},
    {kind:'ogre',x:121,z:-88,scale:1.65,level:6,hp:380,name:'Quarry ogre'},
    {kind:'ogreChampion',x:118,z:-126,scale:1.9,level:8,hp:720,name:'Ridge warden'},
  ].entries()){
    const actor=await human({kind:spec.kind,scale:spec.scale,build:spec.kind==='bandit'?1:1.25,skin:spec.kind==='bandit'?'#c0a080':'#8d947b',outfit:spec.kind==='bandit'?outfit(i,'leather'):['legs.starter']});
    actor.root.position.set(spec.x,terrainHeight(spec.x,spec.z),spec.z);
    targets.push({id:`extra-${spec.kind}-${i}`,name:spec.name,kind:spec.kind,level:spec.level,root:actor.root,position:actor.root.position,home:actor.root.position.clone(),height:1.25*spec.scale,maxHp:spec.hp,hp:spec.hp,materials:[actor.avatar.materials.skin],flash:0,stagger:0,respawn:0,attackTime:0,windup:0,hostile:true,controller:actor,damage:spec.kind==='bandit'?14:spec.kind==='ogre'?23:32});
  }
  let clock=0;
  function destination(person,task){
    const i=person.data.id;
    if(task==='tavern'||task==='rest')return new THREE.Vector3(-19+(i%3-1)*.5,0,-21.5);
    if(task==='sell'||task==='buyTool')return new THREE.Vector3(10+(i%3-1)*.5,0,5);
    if(task==='explore'){const places=[[-5,68],[48,-52],[-60,-5],[65,42]];const p=places[(i+(person.data.decisions??0))%places.length];return new THREE.Vector3(p[0],0,p[1]);}
    if(task==='gather')return new THREE.Vector3(43+(i%3)*3,0,47);
    if(task==='hunt')return new THREE.Vector3(i%2?64+(i%4)*5:83+(i%3)*4,0,i%2?70:-88);
    return new THREE.Vector3((i%3-1)*3,0,-32);
  }
  function move(person,goal,dt,speed){
    if(dt<=0)return 0;
    const startX=person.position.x,startZ=person.position.z;
    const blocked=()=>{person.pathFailedFor=(person.pathFailedFor??0)+dt;return 0;};
    if(navigation.segmentClear(person.position,goal)){person.path=[goal];person.pathGoal=goal.clone();}
    else if((!person.pathGoal||!person.path?.length||person.pathGoal.distanceTo(goal)>2)&&(clock>=(person.nextPathAt??0))){
      person.path=navigation.route(person.position,goal);person.pathGoal=goal.clone();person.nextPathAt=clock+.75;person.pathReplans=(person.pathReplans??0)+1;
    }
    person.path??=[];
    while(person.path.length&&Math.hypot(person.path[0].x-person.position.x,person.path[0].z-person.position.z)<.5){
      if(person.path[1]&&!navigation.segmentClear(person.position,person.path[1]))break;
      person.path.shift();
    }
    const waypoint=person.path[0];if(!waypoint&&Math.hypot(goal.x-person.position.x,goal.z-person.position.z)>2)return blocked();
    const delta=new THREE.Vector3(waypoint?.x??goal.x,person.position.y,waypoint?.z??goal.z).sub(person.position);const distance=delta.length();
    if(distance<.005)return 0;
    const step=Math.min(distance,speed*dt);delta.normalize();
    let nx=person.position.x+delta.x*step,nz=person.position.z+delta.z*step;
    const separated=separatePosition(person,{x:nx,z:nz},living.units(),Math.min(.14,dt*1.8));nx=separated.x;nz=separated.z;
    if(!navigation.segmentClear(person.position,{x:nx,z:nz})){
      nx=person.position.x+delta.x*step;nz=person.position.z+delta.z*step;
      if(!navigation.segmentClear(person.position,{x:nx,z:nz})){
        if(navigation.segmentClear(person.position,{x:nx,z:person.position.z}))nz=person.position.z;
        else if(navigation.segmentClear(person.position,{x:person.position.x,z:nz}))nx=person.position.x;
        else{person.pathGoal=null;return blocked();}
      }
    }
    person.position.x=nx;person.position.z=nz;
    const travelled=Math.hypot(nx-startX,nz-startZ);
    person.pathFailedFor=travelled<dt*.08?(person.pathFailedFor??0)+dt:0;
    if(travelled>Math.max(.001,dt*.08))person.desiredYaw=Math.atan2(delta.x,delta.z);
    person.blockedTime=travelled<dt*.08?(person.blockedTime??0)+dt:0;
    if(person.blockedTime>.75){person.pathGoal=null;person.blockedTime=0;}
    return travelled/dt;
  }
  const living=new LivingWorld(residents,targets,simulation,navigation,move);
  const api={residents,targets,simulation,navigation,living,move,update(dt,player,now=Date.now(),animate=true){
    const homeActive=Math.hypot(player.x,player.z)<245||!animate;
    for(const target of targets){target.dormant=!target.zoneId&&!homeActive;if(target.dormant)target.root.visible=false;}
    for(const person of residents)if(!person.externalSchedule){person.dormant=!homeActive&&!person.companion&&!person.cinematic;if(person.dormant)person.actor.root.visible=false;}
    living.recordDamage=animate;
    clock+=dt;if(homeActive){simulation.advanceTo(now);simulation.society.tick(now);resources.applyEvent(simulation.society.event);resources.ledger.update(now);resources.treeHarvest.update(now);}living.prepare(dt,now);
    for(const target of targets)if(target.hp<=0){
      target.readyAt??=now+(target.kind==='rabbit'?35000:60000);
      if(now>=target.readyAt){target.hp=target.maxHp;if(target.wildlife)target.wildlife.respawn();else target.position.copy(target.home);target.readyAt=null;target.reservedBy=null;target.focusUntil=0;}
    }
    for(const person of residents){
      if(person.cinematic||person.dormant||person.externalSchedule)continue;
      if(person.target.hp<=0){person.actor.root.visible=false;continue;}
      const startX=person.position.x,startZ=person.position.z;
      const distance=person.position.distanceTo(player);person.actor.root.visible=distance<160;
      let speed=0,action=null,seated=Boolean(person.seated),armed=Boolean(person.armed),activity=seated?'drink':'rest';
      let special;
      if(person.companion){
        const slot=person.companionSlot??0,goal=new THREE.Vector3(player.x+Math.cos(slot*2.1)*1.6,0,player.z+Math.sin(slot*2.1)*1.6);
        const gap=Math.hypot(person.position.x-goal.x,person.position.z-goal.z);
        speed=gap>1.0?move(person,goal,dt,gap>5?3.9:1.5):0;
        person.activity=speed?'Following you':'With your party';special={speed,action:null,seated:false,armed:false,activity:'rest'};
      }else special=living.behaviour(person,dt,now);
      if(special){({speed,action,seated,armed,activity}=special);}else{
      if(person.routine){
        const stop=person.routine.goal,goal=new THREE.Vector3(stop.x,0,stop.z),arrived=arrivedAt(person,'routine:'+person.routine.index,Math.hypot(goal.x-person.position.x,goal.z-person.position.z),.5);
        const talking=person.type!=='guard'&&(distance<2.3||(distance<3.5&&person.talkingUntil>now));
        if(!arrived&&!talking)speed=move(person,goal,dt,person.type==='guard'?.95:1.05);
        if(arrived){activity=stop.action;person.activity=stop.label;
          person.desiredYaw=stop.face;
        }else{activity=stop.action==='carry'?'carry':'rest';person.activity=person.type==='guard'?'Patrolling the town':`On the way · ${stop.label}`;}
        if(!talking)person.routine.update(dt,arrived);
      }
      if(person.type==='adventurer'&&person.talkingUntil>now&&distance<3.5){
        person.activity='Talking';person.data.activity='Talking';
      }else if(person.type==='adventurer'){
        const data=person.data,load=()=>Object.values(data.inventory).reduce((a,b)=>a+b,0);
        data.hunger=Math.min(100,data.hunger+dt*.06);
        data.task=chooseActivity(data,simulation.society,now);
        const task=data.task;person.activity=task;let goal=destination(person,task),prey=null,node=null;
        if(task==='hunt'){
          const bounty=simulation.society.guildFor(data.id)?.bounty,groupHunt=bounty&&bounty.progress<bounty.count,kind=groupHunt?bounty.kind:(data.id%2?'rabbit':'goblin');
          prey=targets.find(t=>t.id===person.preyId&&t.hp>0&&t.kind===kind&&(groupHunt||(t.ownerUntil??0)<now));
          prey??=targets.filter(t=>t.hp>0&&t.kind===kind&&(groupHunt||(t.ownerUntil??0)<now&&(!t.reservedBy||t.reservedBy===person.id||(t.reservedUntil??0)<now))).sort((a,b)=>a.position.distanceToSquared(person.position)-b.position.distanceToSquared(person.position))[0];
          if(prey){person.preyId=prey.id;prey.reservedBy=person.id;prey.reservedUntil=now+30000;goal=living.approach.goal(person.target,prey,2.4,now);}
          else{data.task='gather';person.preyId=null;}
        }
        if(task==='gather'){
          node=resources.available().find(n=>n.id===person.nodeId&&n.remaining>0&&(!GATHERING[n.kind]?.tool||data.tools[GATHERING[n.kind].tool]));
          const desired=simulation.society.event?.type==='richSeam'&&data.personality.greed>.6?'iron':data.personality.role==='woodcutter'&&data.tools.axe?'wood':data.personality.role==='miner'?'iron':'herbs';
          node??=resources.available().filter(n=>Math.abs(n.x)<135&&Math.abs(n.z)<135&&(!GATHERING[n.kind]?.tool||data.tools[GATHERING[n.kind].tool])).sort((a,b)=>(a.kind===desired?0:80)+Math.hypot(a.x-person.position.x,a.z-person.position.z)-(b.kind===desired?0:80)-Math.hypot(b.x-person.position.x,b.z-person.position.z))[0];
          if(node){person.nodeId=node.id;goal.set(node.x,0,node.z+1);}
          else if(load()>0)data.task='sell';
        }
        const arrivalRadius=task==='hunt'?.95:task==='sell'?1.3:.65;
        const arrived=task==='hunt'&&prey?inAttackRange(person.position,prey,2.4)&&navigation.segmentClear(person.position,prey.position)&&!living.approach.crowded(person.target):arrivedAt(person,task+':'+(node?.id??''),Math.hypot(goal.x-person.position.x,goal.z-person.position.z),arrivalRadius);
        speed=arrived?0:move(person,goal,dt,task==='hunt'?3.0:1.35);
        person.activity=arrived?(task==='hunt'&&prey?`Fighting ${prey.name}`:task==='gather'&&node?`Gathering ${node.kind}`:TASK_LABELS[task]):TRAVEL_LABELS[task]??'On the road';
        data.activity=person.activity;
        data.stamina=clamp(data.stamina+dt*(arrived&&task==='rest'?1.1:speed?-.045:0),0,100);
        if(person.workTask!==task){person.workTime=0;person.workTask=task;}person.workTime=arrived?(person.workTime??0)+dt:0;
        if(arrived&&task==='rest'){activity='rest';data.health=Math.min(100,data.health+dt*.8);if(data.stamina>85&&data.health>85){data.hunger=25;data.task=chooseActivity(data,simulation.society,now,true);}}
        if(arrived&&task==='tavern'){activity='drink';if(person.workTime>8&&simulation.meal(data,now))data.task=chooseActivity(data,simulation.society,now,true);}
        if(arrived&&task==='sell'){activity='trade';if(person.workTime>3){simulation.sell(data,now);data.task=data.hunger>40?'tavern':chooseActivity(data,simulation.society,now,true);}}
        if(arrived&&task==='buyTool'){activity='trade';if(person.workTime>3){if(buyAxeForActor(data,simulation.shopStock))simulation.record(data,'buy','bought a woodcutting axe from Orin',now);data.task='gather';data.nextDecisionAt=now+30000;}}
        if(arrived&&task==='explore'&&person.workTime>4){data.task=chooseActivity(data,simulation.society,now,true);}
        person.skillAction??=new SkillAction();
        if(arrived&&task==='gather'){
          if(node&&!person.skillAction.current)person.skillAction.start(node,person.position);
          activity=person.skillAction.current?.definition.animation??'rest';
          if(node)facePoint(person,node);
          person.skillAction.update(dt,person.position,false,({node:site})=>{const kind=resources.harvest(site.id,person.position,now);if(kind)simulation.gathered(data,kind,site.id,now,person.position);});
        }else person.skillAction.cancel();
        if(arrived&&task==='hunt'&&prey?.hp>0&&Math.hypot(prey.position.x-person.position.x,prey.position.z-person.position.z)<2.4){
          armed=true;facePoint(person,prey.position);
          if(!person.attack&&clock>=(person.nextHit??0)){person.attack={kind:'sword',style:'cut',side:'R',combo:(person.strikes??0)%SWORD_CUT_COUNT,height:prey.height,elapsed:0,progress:0,target:prey,hit:false};person.strikes=(person.strikes??0)+1;person.nextHit=clock+1.6;}
          if(person.attack?.target!==prey)person.attack=null;
          if(person.attack){
            person.attack.elapsed+=dt;person.attack.progress=Math.min(1,person.attack.elapsed/SWORD_DURATION);action=person.attack;
            if(action.progress>=SWORD_IMPACT&&!action.hit){
              const before=prey.hp;action.hit=true;prey.hp=Math.max(0,prey.hp-12);living.reportDamage(prey,before);simulation.society.recordBountyHit(data.id,prey);prey.flash=.15;data.stamina=Math.max(0,data.stamina-1);simulation.landedHit(data);
              if(prey.hostile&&prey.hp>0){const health=data.health;data.health=Math.max(0,data.health-5);living.reportDamage(person.target,health);person.threat=prey;person.threatUntil=now+1500;facePoint(prey,person.position);prey.focusUntil=now+2000;}
              if(prey.hp===0){api.defeat(prey,now);simulation.defeated(data,prey,now);person.preyId=null;}
            }
            if(action.progress>=1)person.attack=null;
          }
        }else person.attack=null;
      }
      }
      person.position.y=terrainHeight(person.position.x,person.position.z)-(seated?.43:0);
      updateFacing(person,dt);
      // Animation follows displacement, never the desired navigation speed.
      const actualSpeed=dt>0?Math.hypot(person.position.x-startX,person.position.z-startZ)/dt:0;
      speed=actualSpeed<.04?0:Math.min(4,actualSpeed);person.actualSpeed=speed;
      const travelAngle=speed>.12?Math.atan2(person.position.x-startX,person.position.z-startZ)-person.actor.root.rotation.y:0;
      if(person.data)person.data.position=person.position.toArray();
      person.animationTime=(person.animationTime??0)+dt;
      if(animate&&distance<160&&person.animationTime>=(distance<12?1/60:distance<45?1/20:1/8)){
        person.actor.update(Math.min(.12,person.animationTime),{speed,armed,seated,action,activity,travelAngle});person.animationTime=0;
      }
    }
    for(const target of targets){
      if(target.dormant)continue;
      if(target.wildlife)updateWildlife(target,dt,{player,units:residents,navigation,move,animate:animate&&target.position.distanceTo(player)<170});
      updateFacing(target,dt);
      if(!animate)continue;
      if(target.position.distanceTo(player)>170){target.root.visible=false;continue;}target.root.visible=target.hp>0;
      if(target.controller&&target.hp>0){target.animationTime=(target.animationTime??0)+dt;if(target.animationTime>=(target.position.distanceTo(player)<15?1/60:1/12)){
        const speed=target.moving?(target.moveSpeed??1.15):0;
        if(target.windup>0){
          if(!target.animationAction||target.animationStrike!==target.strikes){target.animationStrike=target.strikes;target.animationAction={kind:target.weapon==='sword'||target.kind==='bandit'?'sword':'punch',style:'cut',side:'R',combo:target.attackCombo??0,height:1.1};}
          target.animationAction.progress=clamp(1-target.windup/(target.attackDuration??.7),0,1);
        }else target.animationAction=null;
        target.controller.update(Math.min(.12,target.animationTime),{speed,armed:target.weapon==='sword'||target.kind==='bandit',action:target.animationAction});target.animationTime=0;}}
    }
  },defeat(target,now=Date.now()){if(target.person){living.defeat(target.person,now);return;}target.readyAt=now+(target.kind==='rabbit'?35000:60000);target.root.visible=false;},
  snapshot(){return {targets:targets.map(t=>({id:t.id,hp:t.hp,readyAt:t.readyAt,position:t.position.toArray()})),resources:resources.ledger.snapshot(),trees:resources.treeHarvest.snapshot(),residents:residents.map(p=>({id:p.id,hp:p.target.hp,respawnAt:p.respawnAt,position:p.position.toArray()}))};},
  async catchUp(now=Date.now()){
    const before=simulation.actors.reduce((sum,a)=>sum+a.kills,0),training=simulation.actors.reduce((sum,a)=>sum+a.skill,0),seconds=simulation.offline.seconds;
    const observer=new THREE.Vector3(10000,0,10000);let elapsed=0,count=0;
    while(elapsed<seconds){const dt=Math.min(15,seconds-elapsed);elapsed+=dt;api.update(dt,observer,now-(seconds-elapsed)*1000,false);if(++count%120===0)await new Promise(resolve=>setTimeout(resolve,0));}
    simulation.offline.kills=simulation.actors.reduce((sum,a)=>sum+a.kills,0)-before;simulation.offline.training=simulation.actors.reduce((sum,a)=>sum+a.skill,0)-training;
    resources.update(now);simulation.save(now);
  },nearest(position,radius=3){return residents.filter(p=>p.target.hp>0&&p.position.distanceTo(position)<radius).sort((a,b)=>a.position.distanceToSquared(position)-b.position.distanceToSquared(position))[0]??null;},
  dispose(){all.forEach(actor=>actor.dispose());targets.forEach(target=>target.wildlife?.model.dispose());}};
  for(const person of residents)if(person.data?.position?.length===3&&navigation.walkable(person.data.position[0],person.data.position[2]))person.position.fromArray(person.data.position);
  resources.treeHarvest.restore(simulation.savedWorld?.trees);
  for(const saved of simulation.savedWorld?.residents??[]){const person=residents.find(p=>p.id===saved.id);if(person){person.target.hp=Math.min(person.maxHp,Math.max(0,saved.hp));person.respawnAt=saved.respawnAt;}}
  for(const state of simulation.savedWorld?.targets??[]){const target=targets.find(t=>t.id===state.id);if(target){target.hp=Math.min(target.maxHp,Math.max(0,state.hp));target.readyAt=state.readyAt;if(state.position?.every(Number.isFinite))target.position.fromArray(state.position);}}
  for(const state of simulation.savedWorld?.resources??[]){const node=resources.ledger.nodes.find(n=>n.id===state.id);if(node){node.remaining=state.remaining;node.readyAt=state.readyAt;}}
  simulation.snapshot=()=>api.snapshot();return api;
}
