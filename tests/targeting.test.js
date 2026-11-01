import test from 'node:test';
import assert from 'node:assert/strict';
import {CombatController} from '../src/game/combat.js';
import {cycleTarget,closestTarget,inAttackRange} from '../src/game/targeting.js';
import {JobRoutine,JOB_ROUTES} from '../src/npc/routines.js';
import {TownNavigation} from '../src/world/navigation.js';
const p={position:{x:0,y:0,z:0},yaw:Math.PI};
const enemy=(id,x,z,hp=100)=>({id,position:{x,y:0,z},height:1.25,hp});

test('Tab cycles live nearby targets forward and backward; target need not face player',()=>{
  const a=enemy('a',0,2),b=enemy('b',2,2),dead=enemy('dead',0,1,0),far=enemy('far',0,60),targets=[a,b,dead,far];
  const first=cycleTarget(null,p.position,0,targets);assert.equal(first,a);
  assert.equal(cycleTarget(first,p.position,0,targets),b);
  assert.equal(cycleTarget(b,p.position,0,targets),a);
  assert.equal(cycleTarget(a,p.position,0,targets,true),b);
});
test('attack without selection chooses the nearest living enemy regardless of facing',()=>{
  const front=enemy('front',0,5),behind=enemy('behind',0,-1),dead=enemy('dead',0,.1,0);
  assert.equal(closestTarget(p.position,[front,dead,behind]),behind);
  assert.equal(closestTarget(p.position,[dead,enemy('far',0,50)]),null);
});
test('damage belongs only to selected enemy, rechecks distance at impact, and switching cancels windup',()=>{
  const a=enemy('a',0,2),b=enemy('b',0,1),c=new CombatController();
  c.setTarget(a);c.request('sword');a.position.z=3;
  c.update(.4,p,[a,b]);assert.equal(a.hp,100);assert.equal(b.hp,100);assert.equal(c.events.at(-1).type,'miss');
  c.setTarget(b);assert.equal(c.action,null);c.request('punch');c.update(.3,p,[a,b]);assert.equal(b.hp,88);assert.equal(a.hp,100);
  assert.ok(inAttackRange(p.position,b,1.65));b.position.y=4;assert.ok(!inAttackRange(p.position,b,1.65));
});
test('failed defensive roll does not play block animation; successful block recovers',()=>{
  const player={position:{x:0,y:0,z:0},yaw:Math.PI};
  const c=new CombatController({random:()=>1});assert.equal(c.receive(12,{x:0,z:-1},player),12);assert.equal(c.block,false);
  c.random=()=>0;c.receive(12,{x:0,z:-1},player);assert.equal(c.block,true);c.update(.5,player,[]);assert.equal(c.block,false);
});
test('jobs advance only after arrival and a full work interval; routes avoid walls',()=>{
  const routine=new JobRoutine(JOB_ROUTES.smith);routine.update(100,false);assert.equal(routine.index,0);
  routine.update(25,true);assert.equal(routine.index,0);routine.update(2,true);assert.equal(routine.index,1);
  const wall={minX:-1,maxX:1,minZ:-2,maxZ:2},nav=new TownNavigation([wall],10);
  const route=nav.route({x:-4,z:0},{x:4,z:0});assert.ok(route.length>2);
  let previous={x:-4,z:0};for(const point of route){for(let t=0;t<=1;t+=.05)assert.ok(nav.walkable(previous.x+(point.x-previous.x)*t,previous.z+(point.z-previous.z)*t,.2));previous=point;}
});
test('navigation blocks thin walls between grid centres and validates off-grid endpoints',()=>{
  const nav=new TownNavigation([{minX:-3,maxX:3,minZ:.42,maxZ:.58}],10),start={x:.12,z:-1.1},goal={x:.2,z:2.1};
  const route=nav.route(start,goal);assert.ok(route.length>2);let previous=start;
  for(const point of route){assert.ok(nav.segmentClear(previous,point));previous=point;}
});
