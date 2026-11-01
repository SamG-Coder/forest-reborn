import test from 'node:test';
import assert from 'node:assert/strict';
import {Group,Vector3} from 'three';
import {TreeHarvest,TREE_RESPAWN_MS} from '../src/world/tree-harvest.js';
import {Society,personality,flagState,requestPvpFlag,updatePvpFlag,chooseActivity,shouldFlee} from '../src/npc/society.js';
import {TownLaw,GUARD_WARNING_MS} from '../src/npc/town-law.js';
import {LivingWorld,RESIDENT_RESPAWN_MS} from '../src/npc/living-world.js';
import {AdventurerSimulation} from '../src/npc/simulation.js';
import {buyAxeForActor} from '../src/progression/shop.js';

test('standing trees pay once, remain felled across saves and regrow after their timer',()=>{
  const trees=new TreeHarvest(),node=trees.register('tree:0:0:4',10,20,.5),position={x:10,z:21};
  assert.equal(trees.harvest(node.id,{x:100,z:100},1000),null);assert.equal(trees.harvest(node.id,position,1000),'wood');
  assert.equal(trees.harvest(node.id,position,1000),null);assert.equal(node.remaining,0);
  const reloaded=new TreeHarvest();reloaded.restore(trees.snapshot());const copy=reloaded.register(node.id,10,20,.5);assert.equal(copy.remaining,0);
  reloaded.update(1000+TREE_RESPAWN_MS);assert.equal(copy.remaining,1);assert.equal(reloaded.harvest(copy.id,position,1000+TREE_RESPAWN_MS),'wood');
});

test('guards warn before enforcing, respect departure, and respond immediately to crime',()=>{
  const notices=[],law=new TownLaw(text=>notices.push(text)),unit={id:'player',name:'Ren',hp:100,position:{x:0,z:30},pvp:flagState({enabled:true})},guard={id:'guard',name:'Guard',hp:100,position:{x:0,z:31}};
  law.update([unit],[guard],1000);assert.equal(law.hostiles.size,0);assert.equal(notices.length,1);
  law.update([unit],[guard],1000+GUARD_WARNING_MS-1);assert.equal(law.hostiles.size,0);
  unit.position.z=55;law.update([unit],[guard],12000);assert.equal(law.warnings.size,0);assert.equal(law.hostiles.size,0);
  unit.position.z=30;law.update([unit],[guard],13000);law.update([unit],[guard],23000);assert.ok(law.hostiles.has('player'));
  unit.pvp.wantedUntil=40000;law.warnings.clear();law.update([unit],[guard],24000);assert.ok(law.hostiles.has('player'));
});

test('PvP cannot be cleared in town or combat, then lowers after a safe outdoor countdown',()=>{
  const flag=flagState({enabled:true,combatUntil:10000});requestPvpFlag(flag,false,{x:0,z:60},1000);assert.equal(flag.clearAt,0);
  requestPvpFlag(flag,false,{x:0,z:0},11000);assert.equal(flag.clearAt,0);requestPvpFlag(flag,false,{x:0,z:60},11000);
  updatePvpFlag(flag,{x:0,z:60},40999);assert.ok(flag.enabled);updatePvpFlag(flag,{x:0,z:60},41000);assert.equal(flag.enabled,false);
});

test('guild formation, membership and event contributions use persistent actor identities',()=>{
  const actors=Array.from({length:12},(_,id)=>({id,name:'Actor '+id,personality:personality(id)})),society=new Society(actors,{},1000);
  for(let a=0;a<12;a++)for(let b=0;b<a;b++)society.relationships.improve(a,b,15);
  society.tick(22000);assert.equal(society.guilds[0].ethos,'outlaw');assert.equal(society.guilds[0].members.length,3);
  society.tick(70000);assert.ok(society.guilds.some(g=>g.ethos==='adventure'));assert.equal(new Set(society.guilds.flatMap(g=>g.members)).size,society.guilds.flatMap(g=>g.members).length);
  assert.ok(society.createGuild('Road Lanterns','player','trade',71000));assert.equal(society.join('player',society.guilds[0].id),false);
  society.startEvent('richSeam',72000);assert.equal(society.contribute('player','gather',{x:0,z:0},72000),0);assert.equal(society.contribute('player','gather',{x:60,z:-48},72000),2);
  const restored=new Society(actors,society.snapshot(),73000);assert.equal(restored.guildFor('player').name,'Road Lanterns');assert.equal(restored.event.progress,1);
});

test('individual needs and tool purchases affect decisions; courage changes retreat thresholds',()=>{
  const actor={id:2,personality:personality(2),inventory:{},tools:{},coins:15,health:100,stamina:90,hunger:0},society=new Society([]);
  assert.equal(chooseActivity(actor,society,1000,true),'buyTool');const stock={};assert.ok(buyAxeForActor(actor,stock));assert.equal(actor.coins,0);assert.equal(stock['trader:axe'],19);assert.equal(buyAxeForActor(actor,stock),false);
  actor.health=20;assert.equal(chooseActivity(actor,society,2000,true),'rest');assert.ok(shouldFlee(30,100,.1));assert.equal(shouldFlee(30,100,.9),false);
  const values=new Map(),storage={getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)},sim=new AdventurerSimulation(storage,1000);sim.actors[0].tools.axe=true;sim.society.createGuild('Test guild',0);sim.save(2000);
  const copy=new AdventurerSimulation(storage,3000);assert.ok(copy.actors[0].tools.axe);assert.equal(copy.society.guildFor(0).name,'Test guild');
});

test('living guards deal timed damage without flagging themselves; civilians flee and NPCs respawn',()=>{
  const resident=(id,type,x,z)=>{const root=new Group();root.position.set(x,0,z);return {id,name:id,type,actor:{root,avatar:{materials:{skin:{}}}},home:root.position.clone(),position:root.position};};
  const guard=resident('guard','guard',0,30),worker=resident('worker','worker',5,30),society=new Society([]),simulation={society,level:()=>1};
  const nav={walkable:()=>true,route:(a,b)=>[b],segmentClear:()=>true};
  const move=(person,goal,dt,speed)=>{const direction=goal.clone().sub(person.position);direction.y=0;person.position.addScaledVector(direction.normalize(),speed*dt);return speed;};
  const living=new LivingWorld([guard,worker],[],simulation,nav,move),player={position:new Vector3(0,0,31),dodge:0},combat={hp:100,receive(d){this.hp-=d;}},progress={data:{pvp:flagState({enabled:true})}};
  living.bindPlayer({player,combat,progress,isActive:()=>true,name:'Ren'});living.prepare(.1,1000);assert.equal(living.behaviour(guard,.4,1000),null);
  living.prepare(.1,11001);living.behaviour(guard,.4,11001);assert.ok(combat.hp<100);assert.equal(guard.target.pvp.enabled,false);
  worker.threat=living.player.target;worker.threatUntil=20000;living.prepare(.1,12000);assert.equal(worker.intent.type,'flee');assert.ok(living.behaviour(worker,.1,12000).speed>3);
  living.defeat(worker,13000);assert.equal(worker.target.hp,0);living.prepare(.1,13000+RESIDENT_RESPAWN_MS);assert.equal(worker.target.hp,worker.maxHp);
});
