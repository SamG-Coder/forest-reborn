import test from 'node:test';
import assert from 'node:assert/strict';
import {PlayerProgress} from '../src/progression/save.js';
import {emptyBag,insertItem,moveStack,splitStack} from '../src/progression/inventory.js';
import {denominations} from '../src/progression/currency.js';
import {buyItem,sellStack} from '../src/progression/shop.js';
import {SkillAction} from '../src/game/skill-action.js';
import {skillThreshold} from '../src/progression/skills.js';
import {characterStats} from '../src/progression/character-stats.js';
import {CombatController} from '../src/game/combat.js';
const memory=()=>{const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v)};};

test('currency uses 100 copper per silver and 100 silver per gold',()=>{
  assert.deepEqual(denominations(10203),{gold:1,silver:2,copper:3});assert.deepEqual(denominations(99),{gold:0,silver:0,copper:99});
});
test('bag stacks, splits and moves without losing items; a failed insert does not mutate it',()=>{
  let bag=insertItem(emptyBag(),'herbs',39,20);assert.deepEqual(bag.slice(0,2),[{id:'herbs',count:20},{id:'herbs',count:19}]);
  bag=splitStack(bag,0);assert.equal(bag[0].count,10);assert.equal(bag[2].count,10);
  bag=moveStack(bag,2,1,20);assert.equal(bag[1].count,20);assert.equal(bag[2].count,9);
  const before=JSON.stringify(bag);assert.equal(insertItem(bag,'wood',1000,20),null);assert.equal(JSON.stringify(bag),before);
});
test('full bag permits a gear swap but blocks unequipping; each item has exactly one location',()=>{
  const p=new PlayerProgress(memory());p.addItem('legs.traveller');p.addItem('herbs',23*20);assert.equal(p.data.bag.filter(Boolean).length,24);
  assert.ok(p.equipItem(0));assert.ok(p.data.equipped.includes('legs.traveller'));assert.ok(p.hasItem('legs.starter'));assert.ok(!p.hasItem('legs.traveller'));
  assert.equal(p.unequip('legs'),false);assert.ok(p.data.equipped.includes('legs.traveller'));
});
test('buy/sell checks funds, capacity and stock, and never sells a quest parcel',()=>{
  const p=new PlayerProgress(memory()),stock={};p.data.coins=0;assert.equal(buyItem(p,stock,'trader','sword'),false);p.data.coins=10203;
  assert.ok(buyItem(p,stock,'trader','sword'));assert.equal(p.data.coins,10158);assert.equal(stock['trader:sword'],4);assert.ok(p.hasItem('sword'));
  assert.equal(sellStack(p,0,stock),20);assert.equal(p.data.coins,10178);p.addItem('flour');assert.equal(sellStack(p,0,stock),0);assert.ok(p.hasItem('flour'));
});
test('full bag preserves pending quest rewards, and legacy materials survive migration',()=>{
  const storage=memory();storage.setItem('forest-reborn-progress-v2',JSON.stringify({version:2,owned:['legs.starter'],equipped:['legs.starter'],quests:{},coins:12345,inventory:{herbs:31},weapons:['sword']}));
  const p=new PlayerProgress(storage);assert.equal(p.data.inventory.herbs,31);assert.ok(p.hasItem('sword'));assert.equal(p.data.coins,12345);
  p.data.bag=Array.from({length:24},()=>({id:'herbs',count:20}));p.accept('errand');p.recordObjective('parcel');assert.equal(p.claim('errand'),null);assert.equal(p.data.quests.errand.active,true);
});
test('skill actions require full duration, cancel on movement and cannot complete twice',()=>{
  const action=new SkillAction(),node={kind:'herbs',remaining:3,x:0,z:0},p={x:0,z:1};let rewards=0;
  assert.ok(action.start(node,p));action.update(2,p,false,()=>rewards++);assert.equal(rewards,0);action.update(1,{x:1,z:1},false,()=>rewards++);assert.equal(action.current,null);assert.equal(rewards,0);
  action.start(node,p);action.update(2.5,p,false,()=>rewards++);action.update(10,p,false,()=>rewards++);assert.equal(rewards,1);
});
test('skills retain overflow XP and character armour reduces actual incoming damage',()=>{
  const p=new PlayerProgress(memory());p.addSkillXP('mining',skillThreshold(1)+7);assert.equal(p.data.skills.mining.level,2);assert.equal(p.data.skills.mining.xp,7);
  p.addItem('body.iron-cuirass');p.equipItem(0);const c=new CombatController({random:()=>1});c.stats=characterStats(p.data,p.registry);
  const taken=c.receive(20,{x:0,z:1},{position:{x:0,z:0},yaw:0});assert.ok(taken<20);assert.equal(c.hp,100-taken);
  p.save();assert.deepEqual(new PlayerProgress(p.storage).data,p.data);
});
