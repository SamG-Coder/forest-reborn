import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3} from 'three';
import {PlayerProgress} from '../src/progression/save.js';
import {AdventurerSimulation} from '../src/npc/simulation.js';
import {QuestJourney} from '../src/npc/quest-journey.js';
import {SocialContracts} from '../src/npc/social-contracts.js';
import {localDirections,directionReply,setMapDestination} from '../src/npc/directions.js';
import {QUESTS} from '../src/progression/quests.js';
import {FactionEconomy} from '../src/factions/economy.js';

const storage=()=>({value:null,getItem(){return this.value;},setItem(_,v){this.value=v;}});
function setup(){
  const progress=new PlayerProgress(storage()),sim=new AdventurerSimulation(storage(),Date.now(),1);
  sim.factions.bind(progress);
  const person={id:'adventurer-0',name:'Ewan',type:'adventurer',data:sim.actors[0],position:new Vector3(0,0,0),target:{hp:100,pvp:{enabled:false}}};
  const population={residents:[person],simulation:sim,living:{player:{target:{position:new Vector3(0,0,0)}}},resources:{},move(){return 1;}};
  const journal=new QuestJourney(person,population,progress.registry);person.data.journey.phase='quests';
  const contracts=new SocialContracts(progress,population);population.contracts=contracts;
  return {progress,sim,person,population,journal,contracts};
}
test('directions use local services and live NPC locations; a map pin persists independently of the panel',()=>{
  const {progress,population,person}=setup();
  const tavern={id:'innkeeper',name:'Tomas',role:'Innkeeper',position:new Vector3(-21,0,-20)};population.residents.push(tavern);
  const result=localDirections(person,population,'where is the tavern')[0];
  assert.equal(result.x,-21);assert.equal(result.z,-20);assert.match(directionReply(person,result),/northwest/);
  assert.equal(localDirections(person,population,'castle').length,0);
  assert.equal(localDirections({...person,position:new Vector3(850,0,-850)},population,'castle').length,1);
  setMapDestination(progress,result);const reloaded=new PlayerProgress(progress.storage);assert.equal(reloaded.data.mapPin.name,'Tomas');
  setMapDestination(reloaded,null);assert.equal(reloaded.data.mapPin,null);
});
test('an old economy save retains old stock while adding newly registered resources',()=>{
  const economy=new FactionEconomy({markets:{mosswake:{stock:{wood:7},treasury:50}}});
  assert.equal(economy.markets.mosswake.stock.wood,7);assert.equal(economy.markets.mosswake.treasury,50);assert.ok(economy.markets.mosswake.stock.flax>0);
});
test('joint orders reserve actual funds and require both deliveries before paying and granting trust once',()=>{
  const {contracts,progress,journal,person,sim}=setup(),market=sim.factions.economy.markets.mosswake;
  market.stock.herbs=0;market.stock.flax=0;
  const initial=market.treasury,own=progress.data.coins,theirs=journal.progress.data.coins;
  const {contract:c}=contracts.requestSupply(person);assert.ok(c);const parts=c.contributions;
  assert.equal(market.treasury,initial-parts.player.pay-parts.partner.pay);
  progress.addItem(parts.player.item,parts.player.count);journal.progress.addItem(parts.partner.item,parts.partner.count);
  assert.equal(contracts.deliver(c,'player',{x:100,z:100}),false);
  assert.ok(contracts.deliver(c,'player',c.destination));assert.equal(progress.data.coins,own);assert.equal(c.status,'active');
  assert.ok(contracts.deliver(c,'partner',c.destination));assert.equal(c.status,'completed');
  assert.equal(progress.data.coins,own+parts.player.pay);assert.equal(journal.progress.data.coins,theirs+parts.partner.pay);
  assert.equal(market.stock[parts.player.item],parts.player.count);assert.equal(sim.society.relationships.trust('player',0),14);assert.equal(sim.friends.size,0);
  assert.equal(contracts.deliver(c,'partner',c.destination),false);assert.equal(contracts.cancel(c),false);
  assert.equal(progress.hasItem(parts.player.item),false);
});
test('expiry refunds deposited items and escrow, including after reload',()=>{
  const {contracts,progress,journal,person,population,sim}=setup(),market=sim.factions.economy.markets.mosswake;
  market.stock.herbs=0;market.stock.flax=0;const initial=market.treasury;
  const {contract:c}=contracts.requestSupply(person,1000),part=c.contributions.partner;
  journal.progress.addItem(part.item,part.count);contracts.deliver(c,'partner',c.destination,1100);
  const reloaded=new PlayerProgress(progress.storage),resumed=new SocialContracts(reloaded,population);resumed.update(c.expiresAt+1);
  assert.equal(resumed.agreements[0].status,'expired');assert.equal(market.treasury,initial);assert.ok(journal.progress.hasItem(part.item,part.count));
  resumed.update(c.expiresAt+2000);assert.equal(market.treasury,initial);
});
test('shared quests preserve prerequisites and only nearby contributors share kill objectives',()=>{
  const {contracts,progress,journal,person,population,sim}=setup(),q=QUESTS.find(q=>q.id==='supper');
  progress.data.quests.errand={completed:true};progress.accept(q.id);
  assert.ok(contracts.requestQuest(person,q.id).error);
  journal.progress.data.quests.errand={completed:true};const {contract:c}=contracts.requestQuest(person,q.id);assert.ok(c);
  assert.equal(journal.progress.state(q),'active');
  const target={kind:'rabbit',position:new Vector3(0,0,3)};
  progress.recordKill('rabbit');contracts.recordKill('player',target);assert.equal(journal.progress.data.quests.supper.count,0);
  contracts.recordHit(0,target);progress.recordKill('rabbit');contracts.recordKill('player',target);assert.equal(journal.progress.data.quests.supper.count,1);
  contracts.recordHit(0,target);person.position.set(90,0,0);progress.recordKill('rabbit');contracts.recordKill('player',target);assert.equal(journal.progress.data.quests.supper.count,1);
  person.position.set(0,0,0);progress.recordObjective('rabbit',6);contracts.update();assert.equal(c.status,'active');
  journal.progress.recordObjective('rabbit',6);contracts.update(Date.now()+2000);assert.equal(c.status,'completed');
  assert.equal(sim.society.relationships.trust('player',0),18);assert.equal(progress.data.quests.supper.completed,undefined);
  assert.equal(progress.state(q),'ready');assert.equal(journal.progress.state(q),'ready');
});
test('a partner works on actual missing supplies instead of completing an agreement on a timer',()=>{
  const {contracts,journal,person,sim}=setup();sim.factions.economy.markets.mosswake.stock.herbs=0;sim.factions.economy.markets.mosswake.stock.flax=0;
  const {contract:c}=contracts.requestSupply(person),part=c.contributions.partner;
  let requested=null;journal.obtain=(id,count)=>{requested={id,count};return {activity:'gather'};};
  assert.deepEqual(contracts.task(journal,.1),{activity:'gather'});assert.deepEqual(requested,{id:part.item,count:part.count});
  assert.equal(part.delivered,false);contracts.update(Date.now()+1000);assert.equal(c.status,'active');
});
