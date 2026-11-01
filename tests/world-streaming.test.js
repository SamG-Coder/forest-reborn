import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3,Scene} from 'three';
import {CAMP_DEFINITIONS,CampDirector} from '../src/world/camp-director.js';
import {prepareExpedition,expeditionState} from '../src/world/camp-expeditions.js';
import {treePlacements} from '../src/world/vegetation-placement.js';
import {BATTLE_SITES} from '../src/world/battle-sites.js';
import {NavigationAreas} from '../src/world/navigation-areas.js';
import {LocalLightPool} from '../src/graphics/local-light-pool.js';
import {sampleTerrainChunk} from '../src/world/terrain-chunk.js';
import {terrainHeight} from '../src/world/terrain.js';
import {TownDefence} from '../src/world/town-defence.js';
import {FactionEconomy} from '../src/factions/economy.js';
import {settleBattleSpawns} from '../src/world/battle-obstacles.js';

test('battle locations retain their forest instead of disc-shaped clearings',()=>{
  for(const site of BATTLE_SITES){
    let count=0;
    for(let z=Math.floor((site.z-50)/80);z<=Math.floor((site.z+50)/80);z++)for(let x=Math.floor((site.x-50)/80);x<=Math.floor((site.x+50)/80);x++)count+=treePlacements(x,z).filter(t=>Math.hypot(t.x-site.x,t.z-site.z)<50).length;
    assert.ok(count>12,site.id+' has '+count+' surrounding trees');
  }
});

test('formation slots move out of trunks without moving fallen bodies or clear slots',async()=>{
  const actors=[{hp:10,x:0,z:0},{hp:0,x:0,z:0},{hp:10,x:4,z:2}];
  const clear=(x,z)=>Math.hypot(x,z)>1.1;
  await settleBattleSpawns(actors,clear);
  assert.ok(clear(actors[0].x,actors[0].z));
  assert.deepEqual(actors[1],{hp:0,x:0,z:0});assert.deepEqual(actors[2],{hp:10,x:4,z:2});
});
test('camp raids require local presence and actual surviving members',()=>{
  const d=new CampDirector({},()=>0);let started=0;
  d.update(1000,{nearby:()=>false,available:()=>6,onStart:()=>started++});assert.equal(started,0);
  d.update(1000,{nearby:()=>true,available:()=>2,onStart:()=>started++});assert.equal(started,0);
  d.update(1000,{nearby:c=>c.id==='cart-camp',available:()=>6,onStart:()=>started++});assert.equal(started,1);
  const raid=d.save.camps['cart-camp'].active,copy=JSON.parse(JSON.stringify(d.save));
  assert.equal(new CampDirector(copy).save.camps['cart-camp'].active.id,raid.id);
});
test('a moving expedition retains identities, follows its route and never adds respawned casualties',()=>{
  const def=CAMP_DEFINITIONS[1],d=new CampDirector({},()=>0),raid=d.start(def.id,{strength:6});
  const members=Array.from({length:6},(_,i)=>({id:'bandit-'+i,hp:100,position:new Vector3(def.x,0,def.z)}));
  prepareExpedition(def,raid,members);let state=expeditionState(def,raid,members,9);
  assert.equal(state.phase,'marching');assert.deepEqual(state.goal,{x:-69,z:-82});
  for(const t of members)t.position.set(-69,0,-82);
  state=expeditionState(def,raid,members,20);assert.equal(raid.waypoint,2);assert.equal(state.centre.x,-69);
  members[0].hp=0;expeditionState(def,raid,members,21);members[0].hp=100;
  assert.equal(expeditionState(def,raid,members,22).alive.length,5);
  state=expeditionState(def,raid,members,220);assert.equal(state.phase,'withdrawing');
  raid.waypoint=0;for(const t of members)t.position.set(def.x,0,def.z);
  assert.equal(expeditionState(def,raid,members,250).finished,true);
});
test('a raid only pays once and only for participation',()=>{
  const d=new CampDirector({},()=>0);d.start('cart-camp');assert.equal(d.finish('cart-camp',true),null);
  d.start('cart-camp');d.hit('cart-camp',20,true);assert.equal(d.finish('cart-camp',true).coins,80);assert.equal(d.finish('cart-camp',true),null);
});
test('async navigation detours around obstacles and updates when a gate opens',async()=>{
  const n=new NavigationAreas(null,{worker:false}),wall={minX:-.2,maxX:.2,minZ:-3,maxZ:3};n.add('test',[wall],{x:0,z:0},15);
  const path=await n.requestRoute({x:-5,z:0},{x:5,z:0});assert.ok(path.length>2);
  for(let i=1;i<path.length;i++)assert.ok(n.segmentClear(path[i-1],path[i]));
  n.add('test',[],{x:0,z:0},15);assert.deepEqual(await n.requestRoute({x:-5,z:0},{x:5,z:0}),[{x:5,z:0}]);n.dispose();
});
test('worker terrain samples exactly match world physics at adjacent chunk edges',()=>{
  const a=sampleTerrainChunk(840,-840),b=sampleTerrainChunk(920,-840);
  for(let row=0;row<65;row++){
    assert.equal(a.heights[row*65+64],b.heights[row*65]);
    assert.ok(Math.abs(a.heights[row*65+64]-terrainHeight(880,-880+row*1.25))<.0001);
  }
});
test('torch selection keeps renderer light counts constant through night and movement',()=>{
  const scene=new Scene(),pool=new LocalLightPool(scene),fixtures=new Set(Array.from({length:24},(_,i)=>({position:new Vector3(i*10,2,0),phase:i})));
  for(let i=0;i<400;i++){
    pool.update(fixtures,new Vector3(i*.6,0,0),{dt:1/60,time:i/60,lamps:i>30?1:0});
    assert.equal(scene.children.filter(o=>o.isPointLight&&o.visible).length,8);
    assert.ok(pool.lights.every(l=>!l.castShadow));
  }
  pool.dispose();assert.equal(scene.children.length,0);
});
test('repeated raids close gates at night; damage and repairs consume town supplies',()=>{
  const economy=new FactionEconomy(),defence=new TownDefence({},economy);
  defence.raid('highmere',10);defence.raid('highmere',30);
  defence.update('highmere',['south'],{now:40,night:true,underAttack:false});
  assert.equal(defence.gate('highmere','south').closed,true);assert.equal(economy.markets.highmere.defenceDemand,2);
  assert.ok(defence.damage('highmere','south',1800));assert.equal(defence.gate('highmere','south').closed,false);
  const wood=economy.markets.highmere.stock.wood;
  defence.update('highmere',['south'],{now:50,night:false,underAttack:false});
  assert.equal(defence.gate('highmere','south').hp,100);assert.equal(economy.markets.highmere.stock.wood,wood-2);
});
