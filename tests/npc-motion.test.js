import test from 'node:test';
import assert from 'node:assert/strict';
import {Group,Vector3} from 'three';
import {facePoint,updateFacing,arrivedAt,chooseCombatTarget} from '../src/npc/motion.js';

test('an NPC turns continuously when a goal jitters across the angle wrap',()=>{
  const unit={position:new Vector3(),root:new Group()};let previous=0,sign=0;
  for(let i=0;i<60;i++){
    facePoint(unit,{x:i%2?.002:-.002,z:-10});updateFacing(unit,1/60);
    const d=Math.atan2(Math.sin(unit.root.rotation.y-previous),Math.cos(unit.root.rotation.y-previous));
    assert.ok(Math.abs(d)<=3.6/60+1e-9);
    if(i<35){sign||=Math.sign(d);assert.equal(Math.sign(d),sign);}
    previous=unit.root.rotation.y;
  }
  assert.ok(Math.abs(unit.root.rotation.y)>3);
});
test('arrival hysteresis keeps a work activity stable under small crowd movement',()=>{
  const unit={};assert.equal(arrivedAt(unit,'herbs',.6,.65),true);
  for(const distance of [.66,.63,.7,.75])assert.equal(arrivedAt(unit,'herbs',distance,.65),true);
  assert.equal(arrivedAt(unit,'herbs',1.1,.65),false);
  assert.equal(arrivedAt(unit,'ore',.7,.65),false);
});
test('near-equal hostile distances do not flip the combat target every frame',()=>{
  const unit={position:new Vector3()},a={position:new Vector3(3,0,0)},b={position:new Vector3(-3.1,0,0)};
  assert.equal(chooseCombatTarget(unit,[a,b],0),a);
  for(let i=1;i<120;i++){b.position.x=i%2?-2.99:-3.01;assert.equal(chooseCombatTarget(unit,[a,b],i*50),a);}
  assert.equal(chooseCombatTarget(unit,[b],7000),b);
});
