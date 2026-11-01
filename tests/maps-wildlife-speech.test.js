import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3,BufferGeometry,Float32BufferAttribute} from 'three';
import {MapView} from '../src/ui/map-view.js';
import {TownLaw} from '../src/npc/town-law.js';
import {GuardSpeech} from '../src/audio/guard-speech.js';
import {showSpeech,speechVisible} from '../src/audio/speech-bubbles.js';
import {habitatPoint,RABBIT_HABITATS,updateWildlife} from '../src/npc/wildlife.js';
import {shapeGoblin} from '../src/npc/goblin.js';
import {random} from '../src/world/terrain.js';

test('map drag persists, cursor zoom stays anchored, recentre follows the player',()=>{
  const view=new MapView({x:50,z:70,range:100,size:500});view.pan(50,-25);
  assert.deepEqual([view.x,view.z],[30,80]);view.follow({x:200,z:300});assert.equal(view.x,30);
  const before=view.unproject(120,350);view.zoom(-120,120,350);const after=view.unproject(120,350);
  assert.ok(Math.hypot(before.x-after.x,before.z-after.z)<1e-8);assert.ok(view.range<100);
  view.recenter({x:200,z:300});view.follow({x:201,z:301});assert.deepEqual(view.project(201,301),{x:250,y:250});
  for(let i=0;i<100;i++)view.zoom(300);assert.equal(view.range,2200);
  for(let i=0;i<100;i++)view.zoom(-300);assert.equal(view.range,20);
});

test('guard warning and escalation carry their actual speaker once per encounter',()=>{
  const messages=[],law=new TownLaw((_,now,speech)=>messages.push({...speech,now}));
  const unit={id:'player',name:'Ren',hp:100,position:new Vector3(),pvp:{enabled:true}},guard={id:'guard-0',name:'Mosswake guard',hp:100,position:new Vector3(2,0,0)};
  law.update([unit],[guard],1000);for(let i=0;i<50;i++)law.update([unit],[guard],12000+i*20);
  assert.equal(messages.length,2);assert.ok(messages.every(m=>m.guardId===guard.id&&m.subjectId==='player'&&m.text));
});

test('guard lines queue behind dialogue and muted speech still shows overhead text',()=>{
  const person={id:'guard',position:new Vector3(),target:{hp:100}},living={speechEvents:[{person,text:'Weapons down.',now:1000,subjectId:'player'}]},spoken=[];
  let busy=true;const voices={muted:false,busy:channel=>busy&&channel==='dialogue',speak:(p,t)=>spoken.push([p.id,t])};
  const speech=new GuardSpeech({voices,player:{position:new Vector3()},living});speech.update(1000);assert.equal(spoken.length,0);assert.ok(speechVisible(person.speech,1000));
  busy=false;speech.update(2000);assert.deepEqual(spoken,[['guard','Weapons down.']]);
  voices.muted=true;living.speechEvents.push({person,text:'Stay outside.',now:3000});speech.update(3000);assert.equal(person.speech.text,'Stay outside.');assert.equal(spoken.length,1);
  const bubble=showSpeech(person,'A longer line.',0);bubble.playing=true;assert.ok(speechVisible(bubble,60000));bubble.playing=false;assert.equal(speechVisible(bubble,60000),false);
});

test('habitats sample different safe respawns and roaming actually moves through the world',()=>{
  const rng=random(14),habitat=RABBIT_HABITATS[0],navigation={walkable:(x,z)=>x>60&&z>60,segmentClear:()=>true};
  const a=habitatPoint(habitat,rng,navigation),b=habitatPoint(habitat,rng,navigation);assert.ok(a.x>60&&a.z>60);assert.ok(a.distanceTo(b)>1);
  const position=new Vector3(65,0,65),start=position.clone(),target={position,hp:22,maxHp:22,habitat,wildlife:{rng,wait:0,goal:null,model:{update(){}}}};
  const move=(unit,goal,dt,speed)=>{const direction=goal.clone().sub(unit.position);direction.y=0;unit.position.addScaledVector(direction.normalize(),dt*speed);};
  for(let i=0;i<50;i++)updateWildlife(target,.1,{player:new Vector3(500,0,500),units:[],navigation,move});
  assert.ok(Math.hypot(position.x-start.x,position.z-start.z)>1);assert.ok(target.moving);
});

test('goblin head morph preserves clothing vertices, UVs and indices',()=>{
  const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute([.2,1.4,.1,.12,1.7,.1,.05,1.9,.04],3));g.setAttribute('uv',new Float32BufferAttribute([0,0,.5,.5,1,1],2));g.setIndex([0,1,2]);
  const torso=Array.from(g.attributes.position.array.slice(0,3)),uv=Array.from(g.attributes.uv.array);shapeGoblin(g);
  assert.deepEqual(Array.from(g.attributes.position.array.slice(0,3)),torso);assert.deepEqual(Array.from(g.attributes.uv.array),uv);assert.deepEqual(Array.from(g.index.array),[0,1,2]);assert.ok(g.attributes.position.getX(1)>.14);g.dispose();
});

test('goblin ear tips extend outward and upward without pulling the temple',()=>{
  const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute([.0928,1.663,-.019,-.0928,1.663,-.019,.07,1.663,-.019,.078,1.71,-.019],3));
  shapeGoblin(geometry);const p=geometry.attributes.position;
  assert.ok(p.getX(0)>.30&&p.getX(1)<-.30);assert.ok(p.getY(0)>1.77);
  assert.ok(Math.abs(p.getX(0)+p.getX(1))<1e-6);assert.ok(Math.abs(p.getY(0)-p.getY(1))<1e-6);
  assert.ok(Math.abs(p.getX(2)-.07*1.68)<1e-6);assert.ok(Math.abs(p.getX(3)-.078*1.68)<1e-6);geometry.dispose();
});
