import test from 'node:test';
import assert from 'node:assert/strict';
import {Group,Vector3} from 'three';
import {createBaseRig} from '../src/avatar/rig.js';
import {CharacterAnimator} from '../src/game/animation.js';
import {attachSword} from '../src/game/weapon-sockets.js';
import {CombatController} from '../src/game/combat.js';
import {CombatApproach,separatePosition} from '../src/npc/combat-approach.js';
import {TargetCycle} from '../src/game/targeting.js';

test('forehand and backhand carry the blade across the target in opposite directions',()=>{
  for(const combo of [0,1]){
    const root=new Group(),rig=createBaseRig(root),animator=new CharacterAnimator({root,rig});
    const {markers}=attachSword(rig,new Group());const tips=[];
    const action={kind:'sword',style:'cut',combo,height:1.25,progress:0};
    for(let i=0;i<=120;i++){
      action.progress=i/120;animator.update(1/120,{speed:0,weapon:'sword',action});
      if(i>=30&&i<=73)tips.push(markers.bladeTip.getWorldPosition(new Vector3()));
    }
    const direction=combo===0?1:-1;
    assert.ok((tips.at(-1).x-tips[0].x)*direction>1,'cut crosses the centre line');
    assert.ok(Math.max(...tips.map(p=>p.y))-Math.min(...tips.map(p=>p.y))<.03,'cut does not turn into an overhead chop');
    assert.ok(tips.every(p=>p.z>0),'blade stays in front through the strike');
  }
});

test('combat alternates two cuts and reports the health actually lost, including overkill',()=>{
  const combat=new CombatController({random:()=>1}),target={hp:1000,height:1.3,position:new Vector3(0,0,2)},player={position:new Vector3(),yaw:0};
  combat.setTarget(target);const sequence=[];
  for(let i=0;i<4;i++){combat.stamina=100;combat.request('sword');sequence.push(combat.action.combo);combat.update(.8,player,[target]);}
  assert.deepEqual(sequence,[0,1,0,1]);
  target.hp=7;combat.stamina=100;combat.events.length=0;combat.request('sword');combat.update(.5,player,[target]);
  assert.equal(combat.events.find(e=>e.type==='hit').damage,7);assert.equal(target.hp,0);
  combat.hp=3;combat.events.length=0;assert.equal(combat.receive(50,new Vector3(0,0,1),player),3);
  assert.equal(combat.events[0].damage,3);assert.equal(combat.receive(10,new Vector3(0,0,1),player),0);assert.equal(combat.events.length,1);
});

test('pursuers reserve distinct reachable positions and keep them as their target moves',()=>{
  const target={id:'victim',hp:100,position:new Vector3()},units=Array.from({length:6},(_,i)=>({id:'guard'+i,hp:100,position:new Vector3(0,0,-6-i*.8)}));
  const navigation={walkable:(x,z)=>x<1.5,segmentClear:()=>true},approach=new CombatApproach(navigation,()=>units);
  const goals=units.map(u=>approach.goal(u,target,2.4,1000));
  for(let i=0;i<goals.length;i++){
    assert.ok(goals[i].x<1.5);assert.ok(goals[i].distanceTo(target.position)<2.4);
    for(let j=0;j<i;j++)assert.ok(goals[i].distanceTo(goals[j])>.7);
    units[i].position.copy(goals[i]);
  }
  target.position.z+=.1;
  units.forEach((unit,i)=>assert.ok(approach.goal(unit,target,2.4,1100).distanceTo(goals[i])<.2));
  const overlapping={...units[0],position:units[1].position.clone()},separated=separatePosition(overlapping,overlapping.position,units);
  assert.ok(Math.hypot(separated.x-overlapping.position.x,separated.z-overlapping.position.z)>.01);
});

test('Shift+Tab reverses Tab even after auto-facing rotates toward the selected enemy',()=>{
  const cycle=new TargetCycle(),position=new Vector3();
  const targets=[{id:'front',hp:100,position:new Vector3(0,0,3)},{id:'right',hp:100,position:new Vector3(3,0,0)},{id:'back',hp:100,position:new Vector3(0,0,-3)}];
  assert.equal(cycle.next(targets[0],position,0,targets,false,1000),targets[1]);
  assert.equal(cycle.next(targets[1],position,Math.PI/2,targets,true,1100),targets[0]);
});
