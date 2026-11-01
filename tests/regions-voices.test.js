import test from 'node:test';
import assert from 'node:assert/strict';
import {ZoneStreamer} from '../src/world/zone-streamer.js';
import {BattleSimulation} from '../src/world/battle-simulation.js';
import {voiceProfile,VOICE_BANKS,voiceCacheKey} from '../src/audio/voice-profiles.js';
import {NavigationAreas} from '../src/world/navigation-areas.js';
import {HIGHMERE,HIGHMERE_PLOTS} from '../src/world/region-layout.js';
import {OPENING_LINES,OPENING_DURATION,openingTrack} from '../src/cinematic/opening-script.js';

test('remote zones do no creation or updates; boundaries retain loaded zone until outer radius',async()=>{
  let loads=0,updates=0,disposed=0;
  const zones=new ZoneStreamer([{id:'test',x:1000,z:1000,enter:100,leave:150}],async()=>{loads++;return {update(){updates++;},dispose(){disposed++;}};});
  for(let i=0;i<200;i++)zones.update({x:0,z:0},1/60);
  assert.equal(loads,0);assert.equal(updates,0);
  zones.update({x:1090,z:1000});await Promise.resolve();
  for(const x of [1101,1099,1120,1085])zones.update({x,z:1000},1/60);
  assert.equal(loads,1);assert.equal(updates,4);
  zones.update({x:1160,z:1000});assert.equal(disposed,1);assert.equal(zones.stats()[0].status,'dormant');
});
test('leaving while loading disposes the late runtime without activating it',async()=>{
  let complete,disposed=0;
  const zones=new ZoneStreamer([{id:'test',x:0,z:0,enter:10,leave:20}],()=>new Promise(r=>complete=r));
  zones.update({x:0,z:0});zones.update({x:100,z:0});
  complete({update(){assert.fail('stale zone updated');},dispose(){disposed++;}});await Promise.resolve();
  assert.equal(disposed,1);assert.equal(zones.stats()[0].status,'dormant');
});
test('re-entering a loading region waits for stale registration to be disposed',async()=>{
  const finish=[],order=[];
  const zones=new ZoneStreamer([{id:'test',x:0,z:0,enter:10,leave:20}],()=>{order.push('create');return new Promise(r=>finish.push(r));});
  zones.update({x:0,z:0});zones.update({x:100,z:0});zones.update({x:0,z:0});
  assert.equal(finish.length,1);
  finish[0]({update(){},dispose(){order.push('dispose');}});await Promise.resolve();
  assert.deepEqual(order,['create','dispose','create']);
  finish[1]({update(){},dispose(){}});await Promise.resolve();assert.equal(zones.stats()[0].status,'active');
});
test('distant town uses a small local navigation grid with world-space results',()=>{
  const areas=new NavigationAreas([]);areas.add('city',[{minX:849,maxX:851,minZ:-857,maxZ:-843}],HIGHMERE,30);
  const route=areas.route({x:844,z:-850},{x:857,z:-850});assert.ok(route.length>2);
  for(let i=1;i<route.length;i++)assert.ok(areas.segmentClear(route[i-1],route[i]));
  areas.remove('city');assert.equal(areas.route({x:844,z:-850},{x:857,z:-850}).length,1);
  assert.ok(HIGHMERE_PLOTS.length>=20);
});
test('battle hits have living targets in range and cannot occur during separation',()=>{
  const battle=new BattleSimulation(600);let events=0;
  for(let i=0;i<400;i++)battle.update(.1,(target,damage,attacker,kind)=>{
    if(kind==='strike')assert.ok(Math.hypot(attacker.x-target.x,attacker.z-target.z)<=attacker.reach+.001);assert.ok(damage>0);events++;
  });
  assert.equal(events,battle.hits);assert.ok(battle.defeats>0);
  const isolated=new BattleSimulation(2);isolated.actors[1].x+=100;isolated.update(.1,()=>assert.fail('hit from far away'));
});
test('character voice survives recreation and gender uses matching base voices',()=>{
  const first=voiceProfile({id:'innkeeper'});assert.deepEqual(first,voiceProfile({id:'innkeeper',name:'Tomas'}));
  for(let i=0;i<100;i++)for(const gender of ['male','female'])assert.ok(VOICE_BANKS[gender].includes(voiceProfile({id:'p'+i,gender}).voice));
  assert.equal(voiceProfile({id:'player',gender:'female',voice:'Luna'}).voice,'Luna');
  assert.notEqual(voiceCacheKey(first,'Hello.'),voiceCacheKey(first,'Goodbye.'));
});
test('opening gives both speakers real shots and dialogue fits within the cinematic',()=>{
  for(const line of OPENING_LINES){assert.ok(line.start<line.end&&line.end<OPENING_DURATION);assert.ok(['player','innkeeper'].includes(line.person));}
  assert.equal(openingTrack.sample(39).id,'tomas-introduction');assert.equal(openingTrack.sample(44).id,'player-phone');
});
