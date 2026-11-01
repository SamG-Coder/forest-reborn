import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createBaseRig } from '../src/avatar/rig.js';
import { solveTwoBone } from '../src/game/constraints.js';
import { attachSword } from '../src/game/weapon-sockets.js';
import { CharacterAnimator } from '../src/game/animation.js';
import { WeaponContact, segmentDistance } from '../src/game/weapon-contact.js';
import { sampleGait } from '../src/game/locomotion.js';
import { locomotionArm, swordArm } from '../src/game/arm-motion.js';
import { CombatController } from '../src/game/combat.js';
const v=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
function fixture(){const root=new THREE.Group(),rig=createBaseRig(root);return {root,rig};}

test('IK reaches targets after root, chest and clavicle transforms without changing bone lengths',()=>{
  const {root,rig}=fixture(),b=rig.bones;root.position.set(5,.1,-3);root.rotation.y=.7;b.chest.rotation.y=.35;b.clavicleR.rotation.z=.12;root.updateMatrixWorld(true);
  const target=root.localToWorld(v(-.25,1.25,.4)),hint=root.localToWorld(v(-.4,1.1,-.2));
  const length=b.forearmR.position.length(),lower=b.handR.position.length();
  const solved=solveTwoBone(b.upperArmR,b.forearmR,b.handR,target,hint,new THREE.Quaternion());
  assert.ok(solved.error<1e-6);assert.equal(b.forearmR.position.length(),length);assert.equal(b.handR.position.length(),lower);
  assert.ok(b.handR.getWorldQuaternion(new THREE.Quaternion()).angleTo(new THREE.Quaternion())<1e-6);
});

test('IK unreachable target and collinear hint stay finite',()=>{
  const {rig}=fixture(),b=rig.bones;
  solveTwoBone(b.upperArmR,b.forearmR,b.handR,v(-10,1.445,0),v(-10,1.445,0));
  assert.ok(b.handR.getWorldPosition(v()).toArray().every(Number.isFinite));
});

test('weapon grip remains aligned through guard, gait and complete swing',()=>{
  const avatar=fixture(),animator=new CharacterAnimator(avatar),sword=new THREE.Group();
  const {socket,markers}=attachSword(avatar.rig,sword);
  for(let i=0;i<=120;i++){
    animator.update(1/60,{speed:i<30?3.9:0,weapon:'sword',block:i>30&&i<50,grounding:false,action:i>=60?{kind:'sword',progress:(i-60)/60,combo:0,height:1.2}:null});
    assert.ok(socket.getWorldPosition(v()).distanceTo(markers.primaryGrip.getWorldPosition(v()))<1e-7);
    assert.ok(markers.bladeBase.getWorldPosition(v()).distanceTo(markers.bladeTip.getWorldPosition(v()))>.64999);
    for(const bone of Object.values(avatar.rig.bones))assert.ok(bone.matrixWorld.elements.every(Number.isFinite));
  }
  assert.equal(swordArm(0).shoulder,swordArm(1).shoulder);
});

test('walk and run keep ankles above ground and planted feet stationary',()=>{
  for(const speed of [1.45,3.9]){
    const avatar=fixture(),animator=new CharacterAnimator(avatar);
    let previous={};let contacts=0;
    for(let i=0;i<360;i++){
      avatar.root.position.z+=speed/60;animator.update(1/60,{speed,weapon:'sword'});
      for(const side of ['L','R']){
        const foot=avatar.rig.bones[`foot${side}`].getWorldPosition(v());assert.ok(foot.y>=.1299);
        const contact=animator.footContacts[side];
        if(contact&&previous[side]?.contact===contact){assert.ok(Math.hypot(foot.x-previous[side].foot.x,foot.z-previous[side].foot.z)<.004,JSON.stringify({speed,i,side,phase:animator.phase%1,foot:foot.toArray(),previous:previous[side].foot.toArray(),contact:contact.toArray()}));contacts++;}
        previous[side]={contact,foot};
      }
    }
    assert.ok(contacts>100);
  }
});

test('selected target takes one timed sword hit at 30/60/120 FPS without blade contact',()=>{
  for(const fps of [30,60,120])for(const combo of [0,1,2]){
    const avatar=fixture(),animator=new CharacterAnimator(avatar),sword=new THREE.Group();
    const {markers}=attachSword(avatar.rig,sword),contact=new WeaponContact(markers);
    const combat=new CombatController(),player={position:v(),yaw:0};
    const near={position:v(0,0,.9),height:1.25,hp:100},far={position:v(0,0,2.5),height:1.25,hp:100};
    for(let i=0;i<fps;i++)animator.update(1/fps,{speed:0,weapon:'sword'});
    combat.combo=combo;combat.lastEnd=0;combat.setTarget(near);combat.request('sword');
    for(let i=0;i<fps;i++){
      combat.update(1/fps,player,[near,far],false);avatar.root.rotation.y=player.yaw;
      animator.update(1/fps,{speed:0,weapon:'sword',action:combat.action});
    }
    assert.equal(near.hp,76,`${fps} FPS combo ${combo} near target`);assert.equal(far.hp,100);
  }
});

test('passive block reacts only to a successful frontal defence; punches hit once',()=>{
  const combat=new CombatController({random:()=>0}),player={position:v(),yaw:0};combat.update(.01,player,[]);
  assert.equal(combat.receive(14,v(0,0,1),player),0);assert.equal(combat.receive(14,v(0,0,-1),player),14);
  assert.equal(combat.block,true);assert.ok(combat.stamina<100);combat.update(.5,player,[]);
  const target={position:v(0,0,.8),hp:100,height:1.2};
  combat.setTarget(target);combat.request('punch','L');
  for(let i=0;i<60;i++)combat.update(1/60,player,[target],false);
  assert.equal(target.hp,88);
});

test('segment distance handles crossed and parallel blades',()=>{
  assert.equal(segmentDistance(v(-1),v(1),v(0,-1),v(0,1)),0);
  assert.equal(segmentDistance(v(-1),v(1),v(-1,1),v(1,1)),1);
});



test('walk has continuous support; run has flight, with separate pelvis rise and arm flexion',()=>{
  let flight=0;let walkMin=10,walkMax=-10,runMin=10,runMax=-10;
  for(let i=0;i<200;i++){
    const w=sampleGait('walk',i/200),r=sampleGait('run',i/200);
    assert.ok(w.feet.L.contact||w.feet.R.contact);
    if(r.airborne)flight++;
    walkMin=Math.min(walkMin,w.pelvisY);walkMax=Math.max(walkMax,w.pelvisY);
    runMin=Math.min(runMin,r.pelvisY);runMax=Math.max(runMax,r.pelvisY);
    assert.ok(locomotionArm('L',i/200,0,1).elbow<.46);
    assert.ok(locomotionArm('L',i/200,1,1).elbow>1.1);
  }
  assert.ok(flight>30);assert.ok(walkMax-walkMin>.05);assert.ok(runMax-runMin>.15);
  assert.ok(locomotionArm('L',0,0,1).shoulder<0);
  assert.ok(locomotionArm('R',0,0,1).shoulder>0);
});

test('both sword cuts preserve a neutral wrist instead of twisting it to aim',()=>{
  for(let combo=0;combo<2;combo++){
    const avatar=fixture(),a=new CharacterAnimator(avatar);
    for(let i=0;i<120;i++){
      a.update(1/120,{speed:0,weapon:'sword',action:{kind:'sword',progress:i/119,combo,height:1.25}});
      assert.ok(avatar.rig.bones.handR.quaternion.angleTo(new THREE.Quaternion())<.001);
    }
  }
});


test('buffered combo flows into the next cut before returning to idle',()=>{
  const avatar=fixture(),animator=new CharacterAnimator(avatar),combat=new CombatController();
  const player={position:v(),yaw:0};combat.request('sword');
  const seen=[];let previousAction=null,previousQ=avatar.rig.bones.upperArmR.quaternion.clone();
  for(let frame=0;frame<180;frame++){
    if(seen.length<3&&combat.action?.progress>.2&&!combat.queued)combat.request('sword');
    combat.update(1/60,player,[],false);
    const changed=combat.action&&combat.action!==previousAction;
    animator.update(1/60,{speed:0,weapon:'sword',action:combat.action});
    if(changed){
      seen.push({combo:combat.action.combo,time:combat.time,chained:!!combat.action.chained});
      if(combat.action.chained)assert.ok(avatar.rig.bones.upperArmR.quaternion.angleTo(previousQ)<.20);
    }
    previousAction=combat.action;previousQ.copy(avatar.rig.bones.upperArmR.quaternion);
  }
  assert.deepEqual(seen.map(a=>a.combo),[0,1,0]);assert.equal(seen[1].chained,true);
  assert.ok(seen[1].time<.78);assert.ok(seen[2].time-seen[1].time<.78);
});
