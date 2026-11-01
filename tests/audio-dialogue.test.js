import test from 'node:test';
import assert from 'node:assert/strict';
import {EFFECTS,synthesizeEffect} from '../src/audio/effects.js';
import {rangeFade} from '../src/audio/mixer.js';
import {WorldSounds} from '../src/audio/world-sounds.js';
import {DialogueDirector,dialoguePool} from '../src/audio/dialogue.js';
import {PlayerProgress} from '../src/progression/save.js';
import {takeLoot} from '../src/progression/loot.js';
import {BattleSimulation} from '../src/world/battle-simulation.js';
import {configureFieldRoster} from '../src/npc/field-roster.js';
import {createGearRegistry} from '../src/gear/catalog.js';
import {Vector3} from 'three';
const progress=()=>new PlayerProgress({getItem:()=>null,setItem(){}});

test('action sounds have finite headroom, smooth ends and three non-identical takes',()=>{
  for(const kind of Object.keys(EFFECTS)){
    const samples=[0,1,2].map(v=>synthesizeEffect(kind,v));
    for(const pcm of samples){assert.ok(pcm.every(Number.isFinite));assert.ok(pcm.every(x=>Math.abs(x)<=.851));assert.ok(pcm.some(x=>Math.abs(x)>.02));assert.ok(Math.abs(pcm.at(-1))<.01);}
    assert.notDeepEqual(samples[0],samples[1]);assert.notDeepEqual(samples[1],samples[2]);
  }
  assert.equal(rangeFade(40,40),0);assert.equal(rangeFade(50,40),0);assert.ok(rangeFade(36,40)<rangeFade(30,40));
});
test('sound cues follow real movement, an attack once, and only active job cycles',()=>{
  const events=[],sounds=new WorldSounds({play:(kind)=>events.push(kind)},{residents:[]}),position=new Vector3();
  const state={speed:0,phase:0,activity:'rest',weapon:'sword',grounded:true};
  for(let i=0;i<100;i++)sounds.actor('test',position,state,.02);assert.equal(events.length,0);
  state.speed=1.45;for(let i=0;i<40;i++){state.phase+=.025;sounds.actor('test',position,state,.02);}assert.ok(events.length>=1&&events.every(e=>e==='stepStone'));
  events.length=0;state.speed=0;state.action={progress:0};for(let i=0;i<40;i++){state.action.progress=i/40;sounds.actor('test',position,state,.02);}assert.deepEqual(events,['sword']);
  state.action=null;state.activity='chop';events.length=0;for(let i=0;i<120;i++)sounds.actor('test',position,state,.02);assert.equal(events.filter(e=>e==='chop').length,2);
  events.length=0;state.speed=3.9;for(let i=0;i<120;i++)sounds.actor('test',position,state,.02);assert.equal(events.length,0);
});
test('nearby people vary greetings without rapid repeat speech, and respect injury and quest state',()=>{
  const p=progress(),director=new DialogueDirector(p),lines=[];
  for(let i=0;i<7;i++){const person={id:'guard-'+i,type:'guard'},reply=director.select(person,{now:1000});lines.push(reply.text);assert.equal(reply.speak,true);assert.equal(director.select(person,{now:1100}).speak,false);}
  assert.equal(new Set(lines).size,lines.length);
  const person={id:'npc',type:'adventurer',target:{hp:20,maxHp:100},data:{task:'hunt'}};
  assert.equal(dialoguePool(person,p).key,'injured');person.intent={type:'fight'};assert.equal(dialoguePool(person,p).key,'fighting');
  person.intent=null;person.target.hp=100;person.data.personality={role:'miner'};
  assert.match(director.select(person,{channel:'chat',now:1000}).text,/seam|Dust|rock|blows/);
});
test('looting coins does not take items; a full bag preserves unclaimed loot',()=>{
  const p=progress(),coins=p.data.coins,loot={coins:7,items:[{id:'wood',count:3}]};
  assert.equal(takeLoot(loot,p,'coins'),1);assert.equal(p.data.coins,coins+7);assert.equal(loot.items.length,1);
  p.data.bag=p.data.bag.map(()=>({id:'sword',count:1}));assert.equal(takeLoot(loot,p),0);assert.equal(loot.items[0].count,3);
  p.data.bag[4]=null;assert.equal(takeLoot(loot,p),1);assert.equal(loot.items.length,0);
});
test('field quest enemies use the actual army identities and combat statistics',()=>{
  const registry=createGearRegistry(),sim=new BattleSimulation(1000,{registry}),identities=[...sim.actors];configureFieldRoster(sim,registry);
  assert.deepEqual(sim.actors,identities);assert.equal(sim.actors.filter(a=>a.kind==='shieldbreaker').length,20);
  const giant=sim.actors.find(a=>a.kind==='hillGiant');assert.ok(giant);assert.equal(giant.weapon,'unarmed');assert.equal(giant.maxHp,950);assert.equal(giant.mounted,false);assert.equal(sim.unit(giant.id),giant);
});
