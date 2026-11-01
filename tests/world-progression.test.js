import test from 'node:test';
import assert from 'node:assert/strict';
import {PlayerProgress,STARTING_EQUIPMENT,STARTING_COINS,levelThreshold} from '../src/progression/save.js';
import {QUESTS} from '../src/progression/quests.js';
import {createGearRegistry} from '../src/gear/catalog.js';
import {AdventurerSimulation,SIM_STEP_MS} from '../src/npc/simulation.js';
import {terrainHeight,clampToWorld,chunkSeed,random,WORLD_SIZE} from '../src/world/terrain.js';
import {updateJump} from '../src/game/jump.js';

const memory=()=>{const values=new Map();return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};};

test('new game starts in trousers; kills and quest turn-ins earn persistent gear once',()=>{
  const storage=memory(),p=new PlayerProgress(storage),registry=createGearRegistry();
  assert.deepEqual(p.data.equipped,[...STARTING_EQUIPMENT]);assert.equal(p.claim('supper',registry),null);
  assert.deepEqual(p.data.weapons,[]);assert.equal(p.accept('supper'),false);
  p.accept('errand');p.recordObjective('parcel');assert.equal(p.claim('errand',registry).weapon,'sword');
  assert.deepEqual(p.data.weapons,['sword']);assert.equal(p.claim('errand',registry),null);
  assert.equal(p.accept('briar'),false);assert.equal(p.accept('supper'),true);
  for(let i=0;i<6;i++)p.recordKill('rabbit');assert.equal(p.state(QUESTS.find(q=>q.id==='supper')),'ready');
  assert.ok(!p.data.owned.includes('clothes.traveller-blue'));
  assert.equal(p.claim('supper',registry).item,'clothes.traveller-blue');assert.equal(p.claim('supper',registry),null);
  assert.ok(p.hasItem('clothes.traveller-blue'));assert.ok(!p.data.equipped.includes('clothes.traveller-blue'));assert.equal(p.accept('briar'),true);
  const restored=new PlayerProgress(storage);assert.deepEqual(restored.data,p.data);
});

test('multi-level rewards carry XP correctly and dummy kills do not farm progression',()=>{
  const p=new PlayerProgress(memory());p.addXP(levelThreshold(1)+levelThreshold(2)+17);
  assert.equal(p.data.level,3);assert.equal(p.data.xp,17);assert.equal(p.recordKill('dummy'),null);assert.equal(p.data.coins,STARTING_COINS);
});

test('adventurer progress records completed world actions; elapsed time alone gives no rewards',()=>{
  const now=1700000000000,storage=memory(),online=new AdventurerSimulation(storage,now,16);
  online.toggleFriend(3);online.save(now);
  const before=JSON.stringify(online.actors);online.advanceTo(now+80*SIM_STEP_MS);assert.equal(JSON.stringify(online.actors),before);
  online.defeated(online.actors[0],{kind:'rabbit',name:'Meadow rabbit'},now);online.gathered(online.actors[0],'herbs','herbs-1',now);online.landedHit(online.actors[0]);
  assert.equal(online.actors[0].kills,1);assert.equal(online.actors[0].inventory.herbs,1);assert.equal(online.actors[0].skill,1);
  assert.ok(online.sell(online.actors[0],now)>0);assert.equal(online.stock.herbs,1);assert.deepEqual(online.actors[0].inventory,{});
  online.save(now);const offline=new AdventurerSimulation(storage,now+60000,16);
  assert.deepEqual(offline.actors,online.actors);assert.equal(offline.offline.seconds,60);assert.ok(offline.friends.has(3));
});

test('world spans four kilometres and chunk generation is reproducible',()=>{
  assert.equal(WORLD_SIZE,4000);const p={x:4000,z:-3000};clampToWorld(p);assert.deepEqual(p,{x:1999.5,z:-1999.5});
  const a=random(chunkSeed(15,-8)),b=random(chunkSeed(15,-8));assert.deepEqual(Array.from({length:100},a),Array.from({length:100},b));
  assert.ok(Math.abs(terrainHeight(0,0))<.5,'spawn square remains near its original elevation');assert.ok(Number.isFinite(terrainHeight(1980,1980)));
  for(let x=-1000;x<1000;x+=80)assert.ok(Math.abs(terrainHeight(x,80)-terrainHeight(x+.001,80))<.01);
});

test('jump lands on raised terrain instead of dropping through to zero',()=>{
  const player={position:{y:12},grounded:true};let landed=false;
  for(let i=0;i<180;i++)landed=updateJump(player,1/60,i===0,12)||landed;
  assert.ok(landed);assert.equal(player.position.y,12);assert.ok(player.grounded);
});
