import test from 'node:test';
import assert from 'node:assert/strict';
import {PlayerProgress} from '../src/progression/save.js';
import {RECIPES,craftItem,craftedBag,consumeItem} from '../src/progression/recipes.js';
import {QUESTS} from '../src/progression/quests.js';
import {ResourceLedger} from '../src/world/resources.js';
import {AdventurerSimulation} from '../src/npc/simulation.js';
import {Society,flagState,requestPvpFlag,updatePvpFlag,recordPlayerKill} from '../src/npc/society.js';

function storage(){const values=new Map();return {getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)};}
test('repeated flag-lowering requests retain the deadline; combat explains the pause; skull is independent',()=>{
  const flag=flagState({enabled:true}),outside={x:0,z:70};
  requestPvpFlag(flag,false,outside,1000);requestPvpFlag(flag,false,outside,9000);assert.equal(flag.clearAt,31000);
  recordPlayerKill(flag,10000);flag.combatUntil=40000;updatePvpFlag(flag,outside,12000);
  assert.equal(flag.clearAt,0);assert.equal(flag.clearReason,'In combat');
  updatePvpFlag(flag,outside,40000);assert.equal(flag.clearAt,70000);updatePvpFlag(flag,outside,70000);
  assert.equal(flag.enabled,false);assert.equal(flag.skullUntil,3610000);
  assert.equal(flagState(JSON.parse(JSON.stringify(flag))).skullUntil,3610000);
});
test('a sheep pays one fleece, then regrows instead of being harvested repeatedly',()=>{
  const ledger=new ResourceLedger(),sheep=ledger.nodes.find(n=>n.kind==='wool');
  assert.equal(ledger.harvest(sheep.id,sheep,1000),'wool');assert.equal(ledger.harvest(sheep.id,sheep,1100),null);
  const restored=new ResourceLedger(ledger.snapshot());restored.update(240999);assert.equal(restored.nodes.find(n=>n.id===sheep.id).remaining,0);
  restored.update(241000);assert.equal(restored.harvest(sheep.id,sheep,241000),'wool');
});
test('wool becomes cloth and equipment with actual ingredient costs and skill gates',()=>{
  const progress=new PlayerProgress(storage()),recipe=id=>RECIPES.find(r=>r.id===id);
  progress.addItem('wool',18);
  for(let i=0;i<6;i++)assert.ok(craftItem(progress,recipe('yarn')));
  for(let i=0;i<4;i++)assert.ok(craftItem(progress,recipe('cloth')));
  assert.ok(progress.data.skills.tailoring.level>=3);assert.ok(craftItem(progress,recipe('sewn-tunic')));
  assert.ok(progress.hasItem('clothes.traveller-blue'));assert.equal(progress.hasItem('wool'),false);
  const before=JSON.stringify(progress.data.bag);assert.equal(craftedBag(progress,recipe('iron-cuirass')),null);assert.equal(JSON.stringify(progress.data.bag),before);
  for(const r of RECIPES)assert.equal(progress.item(r.output).type==='Recovered item',false,r.output);
});
test('healing cannot consume an item at full health and its cooldown is persisted',()=>{
  const disk=storage(),progress=new PlayerProgress(disk),combat={hp:100,stamina:100};progress.addItem('healingPotion',2);
  assert.equal(consumeItem(progress,0,combat,1000),false);combat.hp=20;
  assert.ok(consumeItem(progress,0,combat,1000));assert.equal(combat.hp,60);
  assert.equal(consumeItem(new PlayerProgress(disk),0,combat,2000),false);
  assert.ok(consumeItem(progress,0,combat,16000));assert.equal(combat.hp,100);
});
test('contact lists do not grant trust, and a favour transfers real items only once',()=>{
  const disk=storage(),sim=new AdventurerSimulation(disk,1000),progress=new PlayerProgress(disk),actor=sim.actors[2],r=sim.society.relationships;
  sim.toggleFriend(2);assert.equal(r.trust('player',2),0);sim.society.createGuild('Test companions','player');
  assert.match(sim.society.invite(2,1000,progress),/get to know/);assert.ok(r.accept(actor));
  assert.equal(r.complete(actor,progress),false);progress.addItem('wood',3);assert.ok(r.complete(actor,progress));
  assert.equal(progress.hasItem('wood'),false);assert.equal(actor.inventory.wood,3);assert.equal(r.complete(actor,progress),false);
  r.chat(actor,2000);assert.equal(r.trust('player',2),28);r.chat(actor,2100);assert.equal(r.trust('player',2),28);
  sim.society.invite(2,2200,progress);assert.equal(sim.society.guildFor(2).name,'Test companions');
  sim.save(3000);assert.equal(new AdventurerSimulation(disk,4000).society.relationships.trust('player',2),28);
});
test('NPC relationships grow only when actors meet and can lead to their own faction',()=>{
  const sim=new AdventurerSimulation(storage(),1000),s=sim.society;
  for(const id of [1,3,5])Object.assign(sim.actors[id],{position:[id*.3,0,0],task:'tavern'});
  for(let i=0;i<5;i++)s.tick(1000+i*12000);
  s.tick(70000);assert.ok(s.guilds.some(g=>g.members.includes(1)&&g.members.includes(3)));
  assert.equal(s.relationships.trust(0,1),0);
});
test('guild bounties require a party and participation, and pay each member once across reloads',()=>{
  const disk=storage(),sim=new AdventurerSimulation(disk,1000),s=sim.society,p=new PlayerProgress(disk),guild=s.createGuild('Quarry party','player');
  assert.equal(s.acceptBounty(guild.id,'ogres',4,1000),false);s.join(0,guild.id);
  assert.equal(s.acceptBounty(guild.id,'ogres',3,1000),false);assert.ok(s.acceptBounty(guild.id,'ogres',4,1000));
  s.recordBountyKill(0,{kind:'rabbit'},1000);assert.equal(guild.bounty.progress,0);
  s.recordBountyHit('player',{kind:'ogre'});s.recordBountyKill(0,{kind:'ogre'},2000);s.recordBountyKill(0,{kind:'ogre'},3000);
  assert.ok(s.claimBounty('player',p));const coins=p.data.coins;assert.equal(s.claimBounty('player',p),false);
  const restored=new Society(sim.actors,JSON.parse(JSON.stringify(s.snapshot())),4000);assert.equal(restored.claimBounty('player',p),false);assert.equal(p.data.coins,coins);
});
test('every quest prerequisite exists and the story graph has no dead-end dependency cycles',()=>{
  const ids=new Set(QUESTS.map(q=>q.id));assert.equal(ids.size,QUESTS.length);
  for(const quest of QUESTS){const seen=new Set();let q=quest;while(q?.requires){assert.ok(ids.has(q.requires));assert.ok(!seen.has(q.id));seen.add(q.id);q=QUESTS.find(next=>next.id===q.requires);}}
  assert.ok(QUESTS.filter(q=>q.repeatable).length>=3);
});
