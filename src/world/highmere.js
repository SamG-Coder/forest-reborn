import * as THREE from 'three';
import {createTown} from './town.js';
import {terrainHeight} from './terrain.js';
import {HIGHMERE,HIGHMERE_PLOTS} from './region-layout.js';
import {createCastle} from './castle.js';
import {createCrowd} from '../gear/crowd.js';
import {createHumanoid} from '../npc/humanoid.js';
import {createHairSystem} from '../hair/system.js';
import {flagState} from '../npc/society.js';
import {createWorkstations,HIGHMERE_WORKSTATIONS} from './workstations.js';
import {CharacterLOD} from '../gear/character-lod.js';
import {citizenLook} from '../npc/citizen-looks.js';
import {createCityTrees} from './city-trees.js';
import {CASTLE_HOUSEHOLD,updateHousehold} from './castle-household.js';

export const CITY_RESIDENTS=Object.freeze([
  {id:'highmere-marshal',name:'Captain Elian',role:'Field marshal',x:858,z:-795,action:'read',outfit:'plate',greeting:'The east field is getting crowded. Check your straps before you go out there.'},
  {id:'highmere-guild',name:'Mira',role:'Guild registrar',gender:'female',x:819,z:-850,action:'read',greeting:'Names on this side. Bounty reports on the other. Which one are you here for?'},
  {id:'highmere-smith',name:'Doran',role:'Armourer',x:818,z:-805,action:'hammer',greeting:'A split ring is cheap to fix. A split shoulder is not. Let me see your mail.'},
  {id:'highmere-tailor',name:'Lysa',role:'Tailor',gender:'female',x:885,z:-852,action:'sew',greeting:'Hold still a moment. That hem will catch on your boots.'},
  {id:'highmere-cook',name:'Nella',role:'Innkeeper',gender:'female',x:883,z:-805,action:'cook',greeting:'There is stew left, if you are quick. The next patrol is due in.'},
  {id:'highmere-scribe',name:'Corin',role:'Archivist',x:885,z:-893,action:'read',greeting:'You woke up with no record of arriving? You are not the first. Start with your name.'},
  ...CASTLE_HOUSEHOLD,
]);

const CITY_CIRCUIT=[[805,-788],[895,-788],[895,-882],[805,-882]];
const CIRCUIT_LENGTHS=CITY_CIRCUIT.map((a,i)=>{const b=CITY_CIRCUIT[(i+1)%CITY_CIRCUIT.length];return Math.hypot(b[0]-a[0],b[1]-a[1]);});
const CIRCUIT_LENGTH=CIRCUIT_LENGTHS.reduce((sum,n)=>sum+n,0);
function placeCitizen(actor,dt){
  if(actor.stationary)return;
  let distance=((actor.distance%CIRCUIT_LENGTH)+CIRCUIT_LENGTH)%CIRCUIT_LENGTH,index=0;
  while(distance>CIRCUIT_LENGTHS[index])distance-=CIRCUIT_LENGTHS[index++];
  const a=CITY_CIRCUIT[index],b=CITY_CIRCUIT[(index+1)%CITY_CIRCUIT.length],length=CIRCUIT_LENGTHS[index],dx=(b[0]-a[0])/length,dz=(b[1]-a[1])/length;
  actor.position.set(a[0]+dx*distance-dz*actor.lane,0,a[1]+dz*distance+dx*actor.lane);
  actor.heightTime=(actor.heightTime??0)+(dt??1);
  if(actor.heightTime>.15){actor.groundY=terrainHeight(actor.position.x,actor.position.z);actor.heightTime=0;}
  actor.position.y=dt===undefined?actor.groundY:THREE.MathUtils.damp(actor.groundPosition??actor.groundY,actor.groundY,15,dt);actor.groundPosition=actor.position.y;
  const targetYaw=Math.atan2(dx*actor.direction,dz*actor.direction);
  actor.yaw=dt===undefined?targetYaw:(actor.yaw??targetYaw)+THREE.MathUtils.clamp(Math.atan2(Math.sin(targetYaw-actor.yaw),Math.cos(targetYaw-actor.yaw)),-dt*3,dt*3);
  actor.matrix.makeRotationY(actor.yaw).scale(actor.scaleVector).setPosition(actor.position);
}
function citizen(index,count){
  const look=citizenLook(index),actor={id:index,look,clothColor:look.clothColor,pantsColor:look.pantsColor,skinColor:look.skinColor,hairColor:look.hairTint,scaleVector:new THREE.Vector3().setScalar(look.height),position:new THREE.Vector3(),matrix:new THREE.Matrix4(),clip:1,phase:(index*.618)%1,speed:.82+(index%7)*.04,
    distance:(index+.32*Math.sin(index*71.7))*CIRCUIT_LENGTH/count,direction:index%2?1:-1,lane:index%2?.7:-.7,
    tint:new THREE.Color('#ffffff'),wait:0,job:index%9===0?6:1};
  placeCitizen(actor);return actor;
}

export async function createHighmere({scene,world,template,registry,gearMaterials,population,camera,save}){
  const root=new THREE.Group();root.name='Highmere active zone';scene.add(root);
  const town=createTown(root,world.forest.textures.timber,world.materials,world.forest.textures['herb-v2'],{plots:HIGHMERE_PLOTS,name:'Highmere streets',decorations:false});
  const stations=createWorkstations(root,world.materials,world.forest.textures.timber,{definitions:HIGHMERE_WORKSTATIONS});
  world.workstations.stations.push(...stations.stations);
  const fort=await createCastle(root,world.materials),trees=createCityTrees(root,world.materials,world.forest.textures),colliders=[...town.colliders,...fort.colliders,...stations.colliders,...trees.colliders];
  world.extraColliders.push(...colliders);population.navigation.add('highmere',colliders,HIGHMERE,160);
  const residents=[];
  for(const [index,definition]of CITY_RESIDENTS.entries()){
    const look=citizenLook(index+14),outfit=definition.clothes??look.outfit.filter(id=>!id.endsWith('/body'));
    if(definition.outfit)outfit.push('body.iron-cuirass','head.iron-open');
    const actor=await createHumanoid(template,registry,gearMaterials,{bodyType:definition.gender??'male',skin:['#dcb18e','#ae8162','#edc4a3'][index%3],face:index%5,outfit});
    root.add(actor.root);actor.root.position.set(definition.x,terrainHeight(definition.x,definition.z),definition.z);actor.root.rotation.y=definition.face??Math.PI;
    const hair=await createHairSystem(actor.avatar,template.gearTemplates.helmet);hair.setStyle(definition.gender==='female'?'braid':'parted');hair.setColor(index%2?'#533629':'#201c21');hair.setHeadwear(actor.wardrobe.entries.get('head')?.definition);
    const person={...definition,type:'worker',externalSchedule:true,actor,position:actor.root.position,home:actor.root.position.clone(),activity:definition.action,clock:0,health:100,maxHp:100};
    person.target={id:person.id,name:person.name,person,kind:'resident',root:actor.root,position:person.position,height:1.3,level:8,hp:100,maxHp:100,pvp:flagState(),materials:[actor.avatar.materials.skin],flash:0,stagger:0};
    population.residents.push(person);residents.push(person);
  }
  const people=Array.from({length:96},(_,i)=>citizen(i,96));
  // Locals stop in the market as well as walking. Keep the road and stall fronts clear.
  for(let i=0,attempt=0;i<32&&attempt<300;attempt++){
    const x=850+Math.sin(attempt*74.3)*21,z=-832+Math.cos(attempt*21.7)*34;
    if(!population.navigation.walkable(x,z)||Math.abs(x-850)<4||people.some(a=>Math.hypot(a.position.x-x,a.position.z-z)<1.4))continue;
    const actor=citizen(96+i++,32);actor.stationary=true;actor.clip=0;actor.position.set(x,terrainHeight(x,z),z);actor.yaw=attempt*2.4;actor.matrix.makeRotationY(actor.yaw).scale(actor.scaleVector).setPosition(actor.position);people.push(actor);
  }
  const crowd=await createCrowd(root,people.length,{actors:people,extended:true,dynamic:true});
  const characterLOD=new CharacterLOD({actors:people,create:async person=>{
    const look=person.look,actor=await createHumanoid(template,registry,gearMaterials,{bodyType:look.gender,skin:look.skin,face:look.face,scale:look.height,outfit:look.outfit});
    actor.root.visible=false;root.add(actor.root);
    const hair=await createHairSystem(actor.avatar,template.gearTemplates.helmet);hair.setStyle(look.hair);hair.setColor(look.hairColor);
    return actor;
  }});
  let time=save.cityTime??0;
  return {root,residents,crowd,update(dt,player){
    time+=dt;town.update(player);fort.update(time);trees.update(camera);
    for(const person of residents){
      if(person.target.hp<=0){person.respawnAt??=time+90;if(time>=person.respawnAt){person.target.hp=person.target.maxHp;person.respawnAt=null;}}
      const near=person.position.distanceTo(player)<95;person.actor.root.visible=near&&person.target.hp>0;if(!near||person.target.hp<=0)continue;
      if(person.household){updateHousehold(person,dt,{population,player,height:terrainHeight});continue;}
      person.clock+=dt;const phase=person.clock%38;let speed=0;
      // Read / hammer / sew / cook, then a breather. Talking interrupts work.
      const activity=person.talkingUntil>Date.now()?'trade':phase<28?person.action:'rest';
      person.activity=activity==='rest'?'Taking a break':person.role;
      person.poseTime=(person.poseTime??0)+dt;if(person.poseTime>=(person.position.distanceTo(player)<15?1/45:1/15)){person.actor.update(Math.min(.1,person.poseTime),{speed,armed:false,activity:speed?'carry':activity});person.poseTime=0;}
    }
    {const tick=Math.min(dt,.1);for(const actor of people){
      if(actor.stationary)continue;
      actor.distance+=actor.direction*(1.2+actor.phase*.25)*tick;
      actor.moveSpeed=1.2+actor.phase*.25;
      actor.clip=actor.job;placeCitizen(actor,tick);
    }}characterLOD.update(player,dt);crowd.update(camera,time);
  },characterLOD,trees,stats(){return {namedNPCs:residents.length,crowd:crowd.stats(),detail:characterLOD.stats(),citySeconds:time};},dispose(){
    save.cityTime=time;characterLOD.dispose();crowd.dispose();town.dispose();trees.dispose();stations.dispose();for(const station of stations.stations)world.workstations.stations.splice(world.workstations.stations.indexOf(station),1);
    for(const person of residents){population.residents.splice(population.residents.indexOf(person),1);person.actor.dispose();}
    for(const collider of colliders){const i=world.extraColliders.indexOf(collider);if(i>=0)world.extraColliders.splice(i,1);}population.navigation.remove('highmere');
    fort.dispose();root.removeFromParent();
  }};
}
