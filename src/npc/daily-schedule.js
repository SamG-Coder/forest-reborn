import {Vector3} from 'three';
import {facePoint} from './motion.js';

export function scheduleAt(hour,{guard=false,nightShift=false,offset=0}={}){
  const h=(hour+offset+24)%24;
  if(guard){const onDuty=nightShift?(h>=20||h<8):(h>=8&&h<20);return onDuty?'patrol':'sleep';}
  if(h>=22||h<6)return 'sleep';
  if(h<7||h>=12&&h<13||h>=18&&h<20)return 'meal';
  if(h>=20)return 'rest';
  return 'work';
}

/** A schedule owns destinations; navigation and combat remain population systems. */
export class DailySchedule {
  constructor({clock,population,details,townId}){
    Object.assign(this,{clock,population,details,townId});this.people=[];this.seconds=0;
  }
  assign(person,{work,action='sort',patrol,nightShift=false,output='bread',meal,stops,bedIndex=this.people.length}={}){
    const bed=this.details.beds[bedIndex%this.details.beds.length];
    person.daily={work:work?.clone()??person.position.clone(),action,patrol,nightShift,output,bed,stops,workIndex:0,workTime:0,meal:meal?.clone()??person.position.clone(),offset:person.type==='guard'?0:(this.people.length%5)*.08,deliveredHour:-1};
    person.townId=this.townId;person.scheduleOwner=this;this.people.push(person);return person;
  }
  tick(dt){this.seconds+=dt;}
  update(person,dt){
    const d=person.daily;if(!d)return null;
    const emergency=this.population.townLife?.response(person);
    if(emergency){this.wake(person);person.scheduleEmergency=true;person.intent=emergency;return this.population.living.behaviour(person,dt,Date.now());}
    if(person.threat?.hp>0&&person.threatUntil>Date.now()){
      this.wake(person);person.intent=person.type==='guard'?{type:'fight',target:person.threat}:{type:'flee',goal:d.bed?.home.door??d.work,label:'Getting indoors'};
      return this.population.living.behaviour(person,dt,Date.now());
    }
    if(person.scheduleEmergency){person.scheduleEmergency=false;person.intent=null;person.pathGoal=null;}
    if(person.companion||person.deployment)return null;
    if(person.intent&&['fight','flee','leave','return'].includes(person.intent.type))return null;
    person.intent=null;
    const mode=scheduleAt(this.clock.hour,{guard:person.type==='guard',nightShift:d.nightShift,offset:d.offset});
    if(mode!==d.mode){this.wake(person);d.mode=mode;d.arrived=false;person.pathGoal=null;person.intent=null;}
    if(person.useExistingRoutine&&mode==='work'&&!d.inside)return null;
    if(!person.sleeping&&(person.talkingUntil>Date.now()||person.npcTalkingUntil>Date.now())){person.activity='Talking';return {speed:0,armed:false,activity:'trade'};}
    let goal=d.work,activity=d.action,label=person.role;
    if(mode==='sleep'&&d.bed){
      const bed=d.bed,inside=bed.home.inside;
      if(!d.inside){goal=bed.home.door;activity='rest';label='Heading home to sleep';
        if(Math.hypot(person.position.x-goal.x,person.position.z-goal.z)<.8)d.inside=true;
      }
      if(d.inside){goal=bed.position;activity='rest';label='Going to bed';}
      if(d.inside&&Math.hypot(person.position.x-goal.x,person.position.z-goal.z)<.7){
        person.sleeping=true;person.activity='Sleeping · '+bed.home.id.replaceAll('-',' ');
        return {speed:0,armed:false,seated:false,activity:'sleep',sleeping:true};
      }
    }else if(d.inside&&d.bed){
      goal=d.bed.home.door;activity='rest';label='Leaving home';
      if(Math.hypot(person.position.x-goal.x,person.position.z-goal.z)<.8)d.inside=false;
    }else if(mode==='patrol'){
      const stops=d.patrol??[d.work];d.stop??=0;goal=stops[d.stop];activity='watch';label=d.nightShift?'Night watch · patrolling':'Day watch · patrolling';
      if(Math.hypot(person.position.x-goal.x,person.position.z-goal.z)<.7){d.wait=(d.wait??0)+dt;label='Keeping watch';if(d.wait>8){d.stop=(d.stop+1)%stops.length;d.wait=0;}}
    }else if(mode==='meal'||mode==='rest'){goal=d.meal;activity=mode==='meal'?'drink':'rest';label=mode==='meal'?'Taking a meal':'Resting after work';}
    else if(d.stops?.length){
      const stop=d.stops[d.workIndex];goal=new Vector3(stop.x,0,stop.z);activity=stop.action;label=stop.label;
      if(Math.hypot(person.position.x-goal.x,person.position.z-goal.z)<.7){d.workTime+=dt;person.desiredYaw=stop.face??Math.PI;if(d.workTime>stop.seconds){d.workIndex=(d.workIndex+1)%d.stops.length;d.workTime=0;person.pathGoal=null;}}
    }else if(d.action==='carry'){
      d.delivery??=false;goal=d.delivery?d.meal:d.work;
      if(Math.hypot(person.position.x-goal.x,person.position.z-goal.z)<.7){d.wait=(d.wait??0)+dt;if(d.wait>9){d.delivery=!d.delivery;d.wait=0;}}
      label='Delivering supplies';
    }
    const gap=Math.hypot(goal.x-person.position.x,goal.z-person.position.z);
    const speed=gap>.65?this.population.move(person,goal,dt,1.25):0;
    if(speed>0){activity=d.action==='carry'?'carry':'rest';person.activity=label==='Heading home to sleep'?label:mode==='patrol'?label:'Walking · '+label.toLowerCase();}
    else {person.activity=gap>.9?'Waiting for the way to clear':label;if(mode==='work'&&gap<.9){if(!d.stops)facePoint(person,new Vector3(d.work.x,d.work.y,d.work.z-1));
      const hour=Math.floor(this.clock.save.dayTime/3600);if(d.deliveredHour<0)d.deliveredHour=hour;
      if(hour>d.deliveredHour){const economy=this.population.simulation.factions.economy;if(d.output==='arrow.wood')economy.craftArrows(this.townId);else economy.receive(this.townId,d.output,1);d.deliveredHour=hour;person.lastProduction={item:d.output,hour};}
      if(this.seconds%38>30)activity='rest';
    }}
    return {speed,armed:mode==='patrol',seated:false,activity};
  }
  poseSleep(person){
    if(!person.sleeping)return;
    const bed=person.daily.bed,p=bed.position,angle=bed.yaw;
    person.position.set(p.x+Math.sin(angle)*.82,p.y+.64,p.z+Math.cos(angle)*.82);
    person.actor.root.rotation.set(-Math.PI/2,0,0);person.actor.root.rotateOnWorldAxis(new Vector3(0,1,0),angle);
  }
  wake(person){if(person.sleeping){person.sleeping=false;person.actor.root.rotation.set(0,person.daily.bed.yaw,0);person.position.y=person.daily.bed.position.y;person.pathGoal=null;}}
}
