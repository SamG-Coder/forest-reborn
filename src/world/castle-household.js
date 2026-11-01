import {Vector3} from 'three';
import {JobRoutine} from '../npc/routines.js';
import {arrivedAt,facePoint,updateFacing} from '../npc/motion.js';
import {encodeVariant,variantItemIds} from '../gear/variants.js';

const stop=(x,z,seconds,action,label,face=0)=>({x,z,seconds,action,label,face});
const clothes=(dye,ornate=false)=>variantItemIds(encodeVariant({dye,outer:'none',leather:'brown',metal:'bronze',clothFinish:ornate?'brocade':'plain',states:{frontPanel:ornate,backPanel:ornate,belt:true,trim:ornate,helmet:false,necklace:ornate,ringLeft:false,ringRight:false}}));
const resident=(info,stops)=>({...info,household:true,room:'highmere-hall',x:stops[0].x,z:stops[0].z,face:stops[0].face,action:stops[0].action,stops});

/** Positions are working positions beside furniture, not the furniture centres. */
export const CASTLE_HOUSEHOLD=Object.freeze([
  resident({id:'highmere-lord',name:'Lord Edric',role:'Lord of Highmere',clothes:clothes('red',true),greeting:'Corin says more people have been arriving without papers. Come in. Tell me what you remember.'},[
    stop(838,-938.6,32,'read','Reviewing petitions'),
    stop(833,-936,12,'trade','Discussing the accounts',Math.PI/2),
    stop(838,-938.6,24,'watch','Receiving visitors'),
  ]),
  resident({id:'highmere-steward',name:'Steward Elin',role:'Castle steward',gender:'female',clothes:clothes('indigo'),greeting:'If you are here for an audience, wait by the runner. I will let him know.'},[
    stop(832,-926.35,16,'read','Checking the household ledger',Math.PI),
    stop(832,-937,10,'trade','Delivering the accounts',Math.PI/2),
    stop(832,-926.35,18,'read','Recording deliveries',Math.PI),
  ]),
  resident({id:'highmere-servant',name:'Maren',role:'Castle servant',gender:'female',clothes:clothes('ivory'),greeting:'Give me a moment to put this down. They keep moving the linen cupboard.'},[
    stop(832,-936,12,'sew','Mending table linen',-Math.PI/2),
    stop(847,-923.7,10,'wipe','Setting the hall table',Math.PI),
    stop(832,-936,10,'sort','Putting the linen away',-Math.PI/2),
  ]),
  resident({id:'highmere-castle-porter',name:'Bren',role:'Castle porter',clothes:clothes('ochre'),greeting:'Watch the corner there. That bench catches everyone.'},[
    stop(830,-920,8,'carry','Collecting a delivery',Math.PI/2),
    stop(826.5,-923,10,'sort','Stocking the pantry',-Math.PI/2),
    stop(847,-936.4,8,'carry','Delivering cups to the table'),
  ]),
]);

/** Stop clocks run only after arrival. Conversation pauses both travel and work. */
export function updateHousehold(person,dt,{population,player,height,now=Date.now()}){
  person.taskRoutine??=new JobRoutine(person.stops);
  person.jobGoal??=new Vector3();
  const routine=person.taskRoutine,stop=routine.goal;
  const talking=(person.talkingUntil??0)>now;
  let speed=0,activity=stop.action;
  if(talking){activity='trade';person.activity='Talking';facePoint(person,player);}
  else{
    const arrived=arrivedAt(person,'household:'+routine.index,Math.hypot(person.position.x-stop.x,person.position.z-stop.z),.25,.55);
    if(arrived){person.desiredYaw=stop.face;person.activity=stop.label;}
    else{
      person.jobGoal.set(stop.x,0,stop.z);
      speed=population.move(person,person.jobGoal,dt,.95);
      activity=person.id==='highmere-lord'||person.id==='highmere-steward'?'rest':'carry';
      person.activity=speed>.04?'On the way · '+stop.label:'Waiting for the way to clear';
    }
    person.jobTravel=(person.jobTravel??0)+speed*dt;
    if(arrived)person.jobWork=(person.jobWork??0)+dt;
    const previous=routine.index;routine.update(dt,arrived);
    if(previous!==routine.index)person.pathGoal=null;
  }
  person.actualSpeed=speed;person.position.y=height(person.position.x,person.position.z);updateFacing(person,dt);
  person.poseTime=(person.poseTime??0)+dt;
  if(person.poseTime>=(person.position.distanceTo(player)<15?1/45:1/20)){
    person.actor.update(Math.min(.1,person.poseTime),{speed,armed:false,activity});person.poseTime=0;
  }
}
