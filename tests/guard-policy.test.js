import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3} from 'three';
import {canGuardPursue,releaseGuard,guardReacquisitionBlocked} from '../src/npc/guard-policy.js';
import {TownLaw} from '../src/npc/town-law.js';
import {flagState} from '../src/npc/society.js';

test('guards acquire locally and stop at their pursuit and town boundaries',()=>{
  const guard={position:new Vector3(0,0,-35),home:new Vector3(0,0,-35)};
  const target={hp:100,position:new Vector3(0,0,25)};
  assert.equal(canGuardPursue(guard,target),false);
  target.position.z=-30;assert.equal(canGuardPursue(guard,target),true);
  guard.guardAnchor=guard.position.clone();target.position.z=-60;
  assert.equal(canGuardPursue(guard,target,{engaged:true}),false);
  assert.equal(canGuardPursue(guard,target,{engaged:true,retaliating:true}),false);
  target.position.z=-52;assert.equal(canGuardPursue(guard,target,{engaged:true,retaliating:true}),true);
  target.position.set(40,0,-30);guard.position.copy(target.position);
  assert.equal(canGuardPursue(guard,target,{engaged:true,retaliating:true}),false);
  guard.threat=target;guard.attack={};releaseGuard(guard);
  assert.deepEqual(guard.returnPost.toArray(),[0,0,-35]);assert.equal(guard.attack,null);assert.equal(guard.threat,null);
});
test('a skull alone never alerts the town watch',()=>{
  const law=new TownLaw(()=>{}),unit={id:'skulled',hp:100,position:{x:0,z:0},pvp:flagState({skullUntil:999999})};
  law.update([unit],[{id:'guard',hp:100,position:{x:0,z:1}}],1000);
  assert.equal(law.hostiles.size,0);assert.equal(law.warnings.size,0);
});

test('gate crossings keep one warning and encounter until the target actually leaves',()=>{
  const law=new TownLaw(()=>{}),guard={id:'guard',hp:100,position:new Vector3(0,0,38),home:new Vector3(0,0,38)};
  const target={id:'visitor',name:'Visitor',hp:100,position:new Vector3(0,0,41),pvp:flagState({enabled:true})};
  law.update([target],[guard],1000);const deadline=law.warnings.get(target.id).deadline;
  guard.guardAnchor=guard.position.clone();
  for(let i=0;i<100;i++){
    target.position.z=i%2?41.9:42.1;law.update([target],[guard],12000+i*50);
    assert.equal(law.warnings.get(target.id).deadline,deadline);assert.equal(law.hostiles.has(target.id),true);
    assert.equal(canGuardPursue(guard,target,{engaged:true}),true);
  }
  target.position.z=49;law.update([target],[guard],18000);
  assert.equal(law.hostiles.has(target.id),false);assert.equal(canGuardPursue(guard,target,{engaged:true}),false);
  guard.combatTarget=target;releaseGuard(guard,18000);target.position.z=41;
  assert.equal(guardReacquisitionBlocked(guard,target,30000),true);
  target.position.z=35;assert.equal(guardReacquisitionBlocked(guard,target,20000),true);
  assert.equal(guardReacquisitionBlocked(guard,target,30000),false);
});
