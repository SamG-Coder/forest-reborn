import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3} from 'three';
import {BattleDirector,packBattle,unpackBattle} from '../src/world/battle-director.js';
import {BattleSimulation} from '../src/world/battle-simulation.js';
import {PlayerProgress} from '../src/progression/save.js';
import {QUESTS} from '../src/progression/quests.js';
import {createGearRegistry} from '../src/gear/catalog.js';
import {terrainSampler} from '../src/world/terrain-sampler.js';
import {QuestJourney} from '../src/npc/quest-journey.js';
import {BATTLE_SITES,ASHHOLD} from '../src/world/battle-sites.js';
import {FactionEconomy} from '../src/factions/economy.js';
import {chooseHostileOpponent} from '../src/npc/hostile-combat.js';
import {CorpseSystem} from '../src/npc/corpses.js';
import {Group,Scene} from 'three';

const progress=()=>new PlayerProgress({getItem:()=>null,setItem(){}});
test('cavalry has shared equipment, longer reach and unique world identities',()=>{
  const a=new BattleSimulation(1000,{idPrefix:'raid:'}),b=new BattleSimulation(1000,{idPrefix:'field:'});
  assert.equal(a.actors.filter(u=>u.mounted).length,100);
  assert.ok(a.actors.some(u=>u.mounted&&u.attack.grip==='spear'));
  for(const u of a.actors){assert.equal(a.unit(u.id),u);if(u.mounted)assert.ok(u.reach>u.stats.range);}
  assert.equal(new Set([...a.actors,...b.actors].map(u=>u.id)).size,2000);
  let hits=0;for(let i=0;i<1000;i++)a.step(()=>hits++);assert.ok(hits>0);
});
test('world battle cannot spawn until its quest, side choice and camp signal',async()=>{
  const p=progress(),d=new BattleDirector({progress:p});
  d.update(10000);assert.equal(d.canStage(),false);assert.equal(d.begin('cart-road-raid'),false);
  assert.equal(await d.loadSimulation('northern-battle'),null);
  p.data.worldFlags.beaconLit=true;p.data.quests['road-beacon']={completed:true};
  d.update(10000);assert.equal(d.save.campaign.stage,'dormant');
  p.accept('northern-stand');d.update(1);assert.equal(d.save.campaign.stage,'muster');
  d.update(10000);assert.equal(d.save.campaign.stage,'muster','waiting never starts the army');
  assert.equal(d.muster({x:1055,z:-1310}),false,'a side must be chosen');
  assert.ok(d.chooseSide('ash'));assert.equal(d.muster({x:1055,z:-1310}),false,'meet the chosen camp');
  assert.ok(d.muster({x:1485,z:-1292}));assert.equal(d.save.campaign.stage,'battle');
  const sim=await d.loadSimulation('northern-battle');assert.equal(sim.actors.length,10000);
  assert.equal(d.chooseSide('highmere'),false,'cannot swap sides during combat');
});
test('campaign saves preserve casualties and chosen side; participation completes the quest',async()=>{
  const p=progress();p.data.worldFlags.beaconLit=true;p.data.quests['road-beacon']={completed:true};p.accept('northern-stand');
  const d=new BattleDirector({progress:p});d.update(1);d.chooseSide('highmere');d.muster({x:1055,z:-1310});
  const sim=await d.loadSimulation('northern-battle');sim.actors[0].hp=35;
  await d.persist();const reload=new BattleDirector({progress:p,save:JSON.parse(JSON.stringify(d.save))});
  assert.equal((await reload.loadSimulation('northern-battle')).actors[0].hp,35);
  assert.equal(reload.save.campaign.chosenSide,'highmere');
  d.contribute('kills',5);sim.winner=-1;d.resolve(BATTLE_SITES[2],sim);
  assert.equal(p.state(QUESTS.find(q=>q.id==='northern-stand')),'ready');assert.ok(p.claim('northern-stand'));
  assert.equal(p.data.worldFlags.campaignRole,'vanguard');
});
test('packed armies fit normal browser saves and preserve in-flight attacks',()=>{
  const sim=new BattleSimulation(10000,{idPrefix:'campaign:'});sim.actors[50].strike={target:sim.actors[5050].id,hit:false};sim.actors[50].hp=27;
  const packed=packBattle(sim.snapshot());assert.ok(packed.length<3000000);
  const restored=new BattleSimulation(10000,{idPrefix:'campaign:'});restored.restore(unpackBattle(packed));
  assert.equal(restored.actors[50].hp,27);assert.deepEqual(restored.actors[50].strike,sim.actors[50].strike);
});
test('battlefield bounds stay on the real map and sampled slopes have no rounding steps',()=>{
  for(const s of [...BATTLE_SITES,ASHHOLD])assert.ok(Math.abs(s.x)+(s.radius??100)<2000&&Math.abs(s.z)+(s.radius??100)<2000);
  const sample=terrainSampler((x,z)=>x*.2+z*.1);
  for(let x=-5;x<5;x+=.13)assert.ok(Math.abs(sample(x,3)-(x*.2+.3))<1e-10);
});
test('NPC quest journal collects the actual parcel, returns to Tomas and earns the same reward once',()=>{
  const registry=createGearRegistry(),actor={id:0,coins:8,inventory:{},skills:progress().data.skills,tools:{},personality:{role:'fighter'},journey:{phase:'quests',age:0},xp:0};
  const person={id:'adventurer-0',data:actor,position:new Vector3(-19,0,-24),actor:{wardrobe:{apply(){}},root:{visible:true}}};
  const population={residents:[],targets:[],simulation:{factions:{},record(){}},resources:{},move(){return 0;}};
  const agent=new QuestJourney(person,population,registry);
  agent.update(3.1);assert.equal(agent.progress.data.quests.errand.active,true);
  person.position.set(10,0,4.2);agent.update(2.1);assert.ok(agent.progress.hasItem('flour'));
  person.position.set(-19,0,-24);agent.update(3.1);assert.equal(agent.progress.data.quests.errand.completed,true);assert.equal(actor.weapon,'sword');
  const coins=actor.coins;agent.update(.1);assert.equal(actor.coins,coins);
});

test('monsters choose nearby faction enemies and retaliate instead of always selecting the player',()=>{
  const unit={id:'bandit',factionId:'bandits',hp:100,position:new Vector3(0,0,-110)},player={id:'player',hp:100,position:new Vector3(9,0,-110)},guard={id:'guard',hp:100,factionId:'mosswake',position:new Vector3(2,0,-110)};
  const factions={hostile:()=>true,memory:{remembers:()=>false}};
  assert.equal(chooseHostileOpponent(unit,[player,guard],factions,1000),guard);
  unit.recentAttacker=player;unit.recentAttackUntil=5000;
  assert.equal(chooseHostileOpponent(unit,[player,guard],factions,1100),player);
  player.hp=0;assert.equal(chooseHostileOpponent(unit,[player,guard],factions,1200),guard);
});

test('battle guests share target congestion scoring and cavalry damage',()=>{
  const sim=new BattleSimulation(100),a=sim.actors[0],b=sim.actors[50];
  for(const u of sim.actors)u.hp=0;a.hp=b.hp=100;a.x=0;a.z=0;b.x=2;b.z=0;sim.companies[a.squad].enemy=b.squad;
  sim.guests.set('player',{id:'player',team:1,x:2,z:0,hp:100});sim.rebuild();
  assert.equal(sim.nearest(a),b.id,'a nearby company enemy is not discarded for a human player');
  a.revengeTarget='player';a.revengeUntil=10;assert.equal(sim.nearest(a),'player');
  sim.guestClaims.set('player',5);assert.equal(sim.nearest(a),b.id,'spread a crowded attack onto another valid enemy');
});

test('army deaths do not allocate invisible loot meshes; player bags share GPU resources',()=>{
  const scene=new Scene(),corpses=new CorpseSystem(scene),make=id=>{const root=new Group();return {id,name:id,kind:'bandit',hp:0,root,position:root.position,externalSimulation:true};};
  const army=corpses.kill(make('army'),1000,{id:'soldier'});assert.equal(army.bag,undefined);
  const a=corpses.kill(make('a'),1000,{id:'player'}),b=corpses.kill(make('b'),1000,{id:'player'});
  assert.equal(a.bag.children[0].geometry,b.bag.children[0].geometry);corpses.restore(a.target);corpses.update(2000,new Vector3());assert.ok(b.bag.visible);corpses.dispose();
});
