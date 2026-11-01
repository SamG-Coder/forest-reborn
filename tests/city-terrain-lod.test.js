import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3,Group} from 'three';
import {HIGHMERE_ROADS,KEEP_FOOTPRINTS,HIGHMERE} from '../src/world/region-layout.js';
import {terrainHeight} from '../src/world/terrain.js';
import {CharacterLOD} from '../src/gear/character-lod.js';
import {CASTLE_HOUSEHOLD,updateHousehold} from '../src/world/castle-household.js';

test('city roads meet without a height step and stay within walking grades',()=>{
  for(const road of HIGHMERE_ROADS)for(let segment=1;segment<road.points.length;segment++){
    const a=road.points[segment-1],b=road.points[segment],length=Math.hypot(b[0]-a[0],b[1]-a[1]),count=Math.ceil(length*4);
    let previous=terrainHeight(...a);
    for(let i=1;i<=count;i++){
      const t=i/count,x=a[0]+(b[0]-a[0])*t,z=a[1]+(b[1]-a[1])*t,y=terrainHeight(x,z);
      assert.ok(Math.abs(y-previous)/(length/count)<.22,`road grade at ${x},${z}`);previous=y;
    }
  }
});
test('keep footprint is a continuous level foundation for the playable hall',()=>{
  const floor=terrainHeight(838,-930);
  for(const p of KEEP_FOOTPRINTS){
    for(const dx of [-.8,0,.8])for(const dz of [-.8,0,.8]){
      const x=HIGHMERE.x+p.x+dx*(p.r? p.r*.7:p.w/2),z=HIGHMERE.z+p.z+dz*(p.r?p.r*.7:p.d/2);
      assert.ok(Math.abs(terrainHeight(x,z)-floor)<1e-6);
    }
  }
});
test('full crowd characters promote automatically, retain hysteresis, and dispose late loads',async()=>{
  const actor={position:new Vector3(),stationary:true},models=[];
  const create=async()=>{const model={root:new Group(),update(){},dispose(){this.disposed=true;}};models.push(model);return model;};
  const lod=new CharacterLOD({actors:[actor],create});
  lod.update(new Vector3(23,0,0),.016);assert.equal(models.length,0);
  lod.update(new Vector3(20,0,0),.016);assert.ok(!actor.promoted);await Promise.resolve();
  lod.update(new Vector3(20,0,0),.016);assert.equal(actor.promoted,true);
  lod.update(new Vector3(25,0,0),.016);assert.equal(actor.promoted,true);
  lod.update(new Vector3(30,0,0),.016);assert.equal(actor.promoted,false);
  lod.update(new Vector3(24,0,0),.016);assert.equal(actor.promoted,false);
  lod.update(new Vector3(20,0,0),.016);assert.equal(actor.promoted,true);assert.equal(models.length,1);
  lod.dispose();assert.equal(models[0].disposed,true);
  let resolve;const late=new CharacterLOD({actors:[actor],create:()=>new Promise(r=>resolve=r)});
  late.update(new Vector3(),.016);late.dispose();const model=await create();resolve(model);await Promise.resolve();assert.equal(model.disposed,true);
});
test('household work waits for arrival and conversations pause the task cycle',()=>{
  const spec=CASTLE_HOUSEHOLD[1],root=new Group();root.position.set(spec.x,0,spec.z);
  const person={...spec,position:root.position,actor:{root,update(){}}};
  const context={player:new Vector3(838,0,-928),height:()=>0,now:1000,population:{move(p,goal,dt,speed){const d=goal.clone().sub(p.position),distance=d.length(),step=Math.min(distance,dt*speed);if(distance)p.position.addScaledVector(d,step/distance);return step/dt;}}};
  for(let i=0;i<1000;i++)updateHousehold(person,.1,context);
  assert.ok(person.jobTravel>5);assert.ok(person.jobWork>10);assert.ok(person.taskRoutine.cycles>0);
  const index=person.taskRoutine.index,elapsed=person.taskRoutine.elapsed,position=person.position.clone();person.talkingUntil=5000;
  for(let i=0;i<20;i++)updateHousehold(person,.1,context);
  assert.equal(person.taskRoutine.index,index);assert.equal(person.taskRoutine.elapsed,elapsed);assert.ok(person.position.equals(position));assert.equal(person.activity,'Talking');
});
