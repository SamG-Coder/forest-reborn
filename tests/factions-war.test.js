import test from 'node:test';
import assert from 'node:assert/strict';
import {FactionWorld} from '../src/factions/world.js';
import {FactionEconomy} from '../src/factions/economy.js';
import {FACTIONS,standing} from '../src/factions/catalog.js';
import {ThreatMemory} from '../src/factions/threat-memory.js';
import {PlayerProgress} from '../src/progression/save.js';
import {QUESTS} from '../src/progression/quests.js';
import {QUEST_TYPES} from '../src/progression/quest-types.js';
import {rollLoot,takeLoot} from '../src/progression/loot.js';
import {BattleSimulation} from '../src/world/battle-simulation.js';
import {WEAPONS,weaponAction} from '../src/game/weapon-catalog.js';
import {CombatController} from '../src/game/combat.js';
import {createGearRegistry} from '../src/gear/catalog.js';
import {RECIPES} from '../src/progression/recipes.js';
import {addStatus,tickStatuses} from '../src/game/status-effects.js';
const memory=()=>{const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v)};};
const fixture=()=>{const p=new PlayerProgress(memory()),f=new FactionWorld({},1000);f.bind(p);return {p,f};};

test('every existing quest belongs to exactly one of the four categories',()=>{
  for(const q of QUESTS){assert.ok(QUEST_TYPES[q.type],q.id);assert.ok(FACTIONS[q.faction],q.id);if(q.type==='main')assert.ok(q.worldChanges,q.id);if(q.type==='faction')assert.ok(Object.keys(q.reputation).length,q.id);}
});
test('faction work changes both sides of a rivalry and can close an accepted quest',()=>{
  const {p,f}=fixture(),q=QUESTS.find(q=>q.id==='bandit-supplies');p.data.reputation.mosswake=1;
  assert.ok(p.accept(q.id));p.addItem('linen',8);assert.ok(p.claim(q.id));assert.equal(p.hasItem('linen'),false);
  assert.equal(standing(p.data.reputation,'bandits'),-5);assert.equal(standing(p.data.reputation,'mosswake'),-7);
  p.data.quests.briar={completed:true};const guard=QUESTS.find(q=>q.id==='guard-kit');assert.equal(p.state(guard),'locked');
  p.data.reputation.mosswake=5;assert.ok(p.accept(guard.id));p.addItem('bandage',4);p.data.reputation.mosswake=-5;assert.equal(p.claim(guard.id),null);
});
test('main quest changes survive reload and open actual trade between town stocks',()=>{
  const {p,f}=fixture();p.data.quests.briar={completed:true};p.accept('cargo');p.recordObjective('bandit',6);p.claim('cargo');
  assert.ok(f.flags.caravanOpen);f.economy.markets.highmere.stock.iron=40;f.economy.markets.mosswake.stock.wood=40;const before=f.economy.markets.mosswake.stock.iron;f.update(31000);assert.ok(f.economy.markets.mosswake.supplyTrips>0);assert.ok(f.economy.markets.mosswake.stock.iron>=before);
  const loaded=new FactionWorld(JSON.parse(JSON.stringify(f.snapshot())),32000),p2=new PlayerProgress(p.storage);loaded.bind(p2);assert.ok(loaded.flags.caravanOpen);
});
test('shortages raise prices, deliveries lower them, and immediate resale loses money',()=>{
  const e=new FactionEconomy(),m=e.markets.mosswake;m.stock.iron=0;const high=e.quote('smith','iron',5);e.receive('mosswake','iron',120);assert.ok(e.quote('smith','iron',5)<high);
  for(let n=0;n<140;n++){m.stock.iron=n;const paid=e.purchase('smith','iron',1,5),received=e.sellTo('smith','iron',1,5);assert.ok(paid>received,`${n}: ${paid} / ${received}`);}
  m.treasury=0;const stock=m.stock.iron;assert.equal(e.sellTo('smith','iron',4,5),0);assert.equal(m.stock.iron,stock);
});
test('jobs reserve money, require real goods, cannot pay twice and refund expiry',()=>{
  const {p,f}=fixture(),person={id:'smith',name:'Garrick'},[j]=f.jobs.forPerson(person,1000),market=f.economy.markets.mosswake;
  const treasury=market.treasury;assert.ok(f.jobs.accept(j.id,p,1001));assert.equal(market.treasury,treasury-j.pay);assert.equal(f.jobs.complete(j.id,p,1002),false);
  p.addItem(j.item,j.count);const money=p.data.coins,stock=market.stock[j.item];assert.ok(f.jobs.complete(j.id,p,1003));assert.equal(p.data.coins,money+j.pay);assert.equal(market.stock[j.item],stock+j.count);assert.equal(f.jobs.complete(j.id,p,1004),false);
  const [next]=f.jobs.forPerson(person,2000);const t=market.treasury;f.jobs.accept(next.id,p,2001);f.jobs.expire(2000000);assert.equal(market.treasury,t);
});
test('mob memory is bounded, persistent, conditional and capped at four veteran levels',()=>{
  const memory=new ThreatMemory(),target={id:'goblin-1',factionId:'briar',level:2,maxHp:60,damage:10};
  for(let i=0;i<30;i++){const attacker={id:'hero-'+i,level:20,factionId:'highmere'};memory.killed(target,attacker,1000+i);memory.respawn(target,()=>0);}
  assert.equal(target.level,6);assert.equal(Object.keys(memory.units[target.id].grudges).length,4);assert.ok(memory.remembers(target,'hero-29',2000));assert.ok(!memory.remembers(target,'hero-29',90000000));
  const restored=new ThreatMemory(JSON.parse(JSON.stringify(memory.snapshot())));assert.deepEqual(restored.snapshot(),memory.snapshot());
  const low={id:'fair',factionId:'briar',level:2,maxHp:60};for(let i=0;i<20;i++){memory.killed(low,{id:'peer',level:2},1000);memory.respawn(low,()=>0);}assert.equal(low.level,2);
});
test('kill credit does not auto-loot; partial looting preserves items when the bag is full',()=>{
  const {p}=fixture(),coins=p.data.coins;p.recordKill('goblin');assert.equal(p.data.coins,coins);assert.ok(!p.hasItem('goblinScrap'));
  const loot=rollLoot('goblin',()=>0);p.data.bag=Array.from({length:24},()=>({id:'wood',count:20}));takeLoot(loot,p);assert.ok(loot.items.length>0);assert.equal(loot.coins,0);
  p.data.bag[0]=null;const before=p.data.coins;takeLoot(loot,p);assert.equal(p.data.coins,before);assert.ok(p.hasItem('goblinScrap'));assert.ok(loot.items.length>0);
});
test('all weapon and armour tiers have crafting paths, level gates and save-safe equip IDs',()=>{
  const {p}=fixture();assert.equal(Object.keys(WEAPONS).length,13);
  for(const id of Object.keys(WEAPONS).filter(id=>id!=='sword'))assert.ok(RECIPES.some(r=>r.output===id));
  p.addItem('weapon.ember');assert.equal(p.equipItem(0),false);p.data.level=10;assert.ok(p.equipItem(0));const loaded=new PlayerProgress(p.storage);assert.equal(loaded.data.weapon,'weapon.ember');assert.ok(loaded.data.weapons.includes('weapon.ember'));assert.ok(loaded.unequip('weapon'));assert.ok(loaded.hasItem('weapon.ember'));
  const registry=createGearRegistry();for(const tier of ['scout','guard','veteran'])for(const slot of ['head','body','clothes','legs','shoes','necklace','ringLeft','ringRight']){const id=slot+'.'+tier;assert.equal(registry.get(id).slot,slot);assert.ok(RECIPES.some(r=>r.output===id));}
});
test('weapon speed and damage alter real attacks; effects expire without stacking infinitely',()=>{
  for(const id of ['weapon.dagger','weapon.longsword']){
    const c=new CombatController(),target={hp:1000,position:{x:0,y:0,z:1},height:1.2};c.weapon=id;c.target=target;c.request();const expected=weaponAction(id);assert.equal(c.action.damage,expected.damage);assert.equal(c.action.duration,expected.duration);
  }
  const t={hp:100};addStatus(t,{type:'burn',power:4,duration:3},0);addStatus(t,{type:'burn',power:4,duration:3},0);let hits=0;for(let i=1;i<=5;i++)tickStatuses(t,i,()=>hits++);assert.equal(t.hp,88);assert.equal(hits,3);assert.equal(t.statusEffects.length,0);
});
test('500 vs 500 stays deterministic across render rates and validates each damage event',()=>{
  const a=new BattleSimulation(1000),b=new BattleSimulation(1000);let hits=0;
  for(let i=0;i<600;i++)a.update(.05,(target,damage,attacker,kind)=>{assert.notEqual(attacker.side,target.side);if(kind==='strike')assert.ok(Math.hypot(target.x-attacker.x,target.z-attacker.z)<=attacker.reach+.001);assert.ok(target.hp>=0&&damage>0);hits++;});
  for(let i=0;i<1800;i++)b.update(1/60);
  assert.equal(a.hits,hits);assert.equal(a.hits,b.hits);assert.equal(a.defeats,b.defeats);assert.ok(a.hits>100);assert.ok(a.defeats>0);assert.ok(a.perceptionChecks<a.steps*1000*1000/100);
  for(const unit of a.actors)assert.ok(Number.isFinite(unit.x)&&Number.isFinite(unit.z)&&Number.isFinite(unit.yaw));
});
