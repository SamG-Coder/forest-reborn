import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3,BufferGeometry,Float32BufferAttribute} from 'three';
import {PlayerProgress} from '../src/progression/save.js';
import {QUESTS} from '../src/progression/quests.js';
import {questMarkerFor} from '../src/progression/quest-markers.js';
import {purchaseMount} from '../src/mounts/catalog.js';
import {DialogueDirector} from '../src/audio/dialogue.js';
import {dismountPoint,indoors} from '../src/mounts/controller.js';
import {shapeGoblin} from '../src/npc/goblin.js';
import {questGuide} from '../src/progression/quest-guide.js';
import {WORKSTATIONS,HIGHMERE_WORKSTATIONS} from '../src/world/workstations.js';
import {RESOURCE_SITES} from '../src/world/resources.js';

const storage=()=>{const values=new Map();return {getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)};};
test('opening journey earns one persistent horse, then delivers the letter to the lord',()=>{
  const saved=storage(),p=new PlayerProgress(saved);assert.deepEqual(p.data.mounts,[]);
  for(const id of ['errand','supper','briar','cargo']){const q=QUESTS.find(q=>q.id===id);assert.ok(p.accept(id));p.recordObjective(q.kind,q.count);assert.ok(p.claim(id));}
  assert.ok(p.accept('saddle-earned'));p.recordObjective('talk:stablemaster');
  assert.equal(questMarkerFor('stablemaster',p),'?');assert.notEqual(questMarkerFor('captain',p),'?');
  assert.ok(p.claim('saddle-earned'));assert.equal(p.claim('saddle-earned'),null);
  const restored=new PlayerProgress(saved);assert.deepEqual(restored.data.mounts,['bay']);assert.equal(restored.data.activeMount,'bay');
  assert.ok(restored.accept('north-road'));restored.recordObjective('discover:highmere');assert.equal(restored.state(QUESTS.find(q=>q.id==='north-road')),'active');
  restored.recordObjective('talk:highmere-lord');assert.equal(questMarkerFor('highmere-lord',restored),'?');assert.ok(restored.claim('north-road'));
  assert.ok(restored.accept('unlisted-arrival'));restored.recordObjective('talk:highmere-scribe');assert.equal(questMarkerFor('highmere-scribe',restored),'?');
});
test('horse purchases charge once and ownership stays within its save',()=>{
  const saved=storage(),p=new PlayerProgress(saved);p.data.coins=649;
  assert.equal(purchaseMount(p,'grey'),false);assert.equal(p.data.coins,649);p.data.coins=700;
  assert.equal(purchaseMount(p,'grey'),true);assert.equal(p.data.coins,50);
  assert.equal(purchaseMount(p,'grey'),false);assert.equal(p.data.coins,50);
  assert.deepEqual(new PlayerProgress(saved).data.mounts,['grey']);assert.deepEqual(new PlayerProgress(storage()).data.mounts,[]);
});
test('quest destinations point to the actual resource or workshop, including Highmere crafting',()=>{
  const progress=new PlayerProgress(storage());
  const guide=id=>questGuide(QUESTS.find(q=>q.id===id),progress);
  for(const [id,kind]of [['first-fleece','wool'],['berries','berries'],['iron-stock','iron']]){
    const destination=guide(id),site=RESOURCE_SITES.find(s=>s.kind===kind);
    assert.deepEqual([destination.x,destination.z],[site.x,site.z]);
  }
  for(const [id,stations,stationId]of [['first-yarn',WORKSTATIONS,'weaver'],['hot-meal',WORKSTATIONS,'kitchen'],['steel-work',HIGHMERE_WORKSTATIONS,'forge']]){
    const destination=guide(id),station=stations.find(s=>s.id===stationId);
    assert.deepEqual([destination.x,destination.z],[station.x,station.z]);assert.ok(destination.place.includes(station.name));
  }
  assert.deepEqual([guide('east-road').x,guide('east-road').z],[105,-16]);
});
test('dialogue changes with the speaker task and never restarts on rapid conversation clicks',()=>{
  const p=new PlayerProgress(storage()),director=new DialogueDirector(p),person={id:'adventurer-1',type:'adventurer',data:{task:'sell'}};
  const first=director.select(person,{now:0});assert.match(first.text,/supplies|bag|Orin/);assert.equal(first.speak,true);
  assert.equal(director.select(person,{now:100}).speak,false);assert.equal(director.select(person,{channel:'ambient',now:500}),null);
  const second=director.select(person,{now:13000});assert.notEqual(first.text,second.text);
  person.data.task='rest';const changed=director.select(person,{now:14000});assert.match(changed.text,/feet|longer|rested/);
  const ambient=director.select({id:'guard-1',type:'guard'},{channel:'ambient',now:15000});assert.ok(ambient);
  assert.equal(director.select({id:'guard-2',type:'guard'},{channel:'ambient',now:16000}),null);
});
test('dismount searches the safe side and refuses walls or cliffs',()=>{
  const pos=new Vector3(),nav={walkable:x=>x<0,segmentClear:()=>true};assert.ok(dismountPoint(pos,0,nav,()=>0).x<0);
  assert.equal(dismountPoint(pos,0,{walkable:()=>false,segmentClear:()=>false},()=>0),null);
  assert.equal(dismountPoint(pos,0,{walkable:()=>true,segmentClear:()=>true},()=>10),null);
  assert.equal(indoors({x:838,z:-930}),true);assert.equal(indoors({x:0,z:-60}),false);
});
test('goblin nose projects to a point without pulling the eyes or the back of the skull',()=>{
  const g=new BufferGeometry().setAttribute('position',new Float32BufferAttribute([0,1.633,.09,.028,1.633,.07,0,1.633,-.08,0,1.69,.05],3));shapeGoblin(g);const p=g.attributes.position;
  assert.ok(p.getZ(0)-p.getZ(1)>.09);assert.ok(Math.abs(p.getZ(2)+.08*1.42)<1e-6);assert.ok(Math.abs(p.getZ(3)-.05*1.42)<1e-6);g.dispose();
});
