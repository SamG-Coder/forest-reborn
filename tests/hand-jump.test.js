import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createBaseRig} from '../src/avatar/rig.js';
import {CharacterAnimator} from '../src/game/animation.js';
import {attachSword} from '../src/game/weapon-sockets.js';
import {poseHand} from '../src/game/hand-poses.js';
import {updateJump} from '../src/game/jump.js';
const v=()=>new THREE.Vector3();
function fixture(){const root=new THREE.Group(),rig=createBaseRig(root);return {root,rig};}

test('slash travels in its cutting plane and thrust points forward, with bounded wrist deviation',()=>{
  for(const style of ['cut','thrust'])for(let combo=0;combo<3;combo++){
    const avatar=fixture(),a=new CharacterAnimator(avatar),sword=new THREE.Group(),{markers}=attachSword(avatar.rig,sword);
    const action={kind:'sword',style,combo,height:1.25,progress:0};let previous;
    for(let i=0;i<120;i++){
      action.progress=i/119;a.update(1/120,{speed:0,weapon:'sword',action});
      const point=markers.bladeTip.getWorldPosition(v()),base=markers.bladeBase.getWorldPosition(v());
      if(previous&&action.progress>.36&&action.progress<.60){
        if(style==='cut'){
          const normal=new THREE.Vector3(0,0,1).applyQuaternion(sword.getWorldQuaternion(new THREE.Quaternion()));
          assert.ok(Math.abs(normal.dot(point.clone().sub(previous).normalize()))<.12);
        }else assert.ok(point.clone().sub(base).normalize().dot(new THREE.Vector3(0,0,1))>.999);
        assert.ok(avatar.rig.bones.handR.quaternion.angleTo(new THREE.Quaternion())<(style==='thrust'?.20001:1e-5));
      }
      previous=point;
    }
  }
});

test('fist curls fingers back toward palm and thumb stays outside; punches keep wrists straight',()=>{
  const avatar=fixture(),a=new CharacterAnimator(avatar);
  for(const side of ['L','R']){
    poseHand(avatar.rig,side,'fist');avatar.root.updateMatrixWorld(true);
    const hand=avatar.rig.bones[`hand${side}`];
    for(const finger of ['index','middle','ring','little']){
      const segment=avatar.rig.segments.find(b=>b.name===`${finger}3${side}`);
      const tip=avatar.rig.bones[segment.name].localToWorld(segment.end.clone().sub(segment.start));
      hand.worldToLocal(tip);assert.ok(Math.abs(tip.x)<.08,`${finger} closes into palm`);
    }
    const thumb=hand.worldToLocal(avatar.rig.bones[`thumb2${side}`].getObjectByName(`thumbTip${side}`).getWorldPosition(v()));
    assert.ok(thumb.y<-.025);
    const action={kind:'punch',side,height:1.25,progress:0};
    for(let i=0;i<60;i++){action.progress=i/59;a.update(1/60,{speed:0,weapon:'unarmed',action});assert.ok(hand.quaternion.angleTo(new THREE.Quaternion())<1e-5);}
  }
});

test('jump lands consistently at 30/60/120 FPS and cannot double jump',()=>{
  for(const fps of [30,60,120]){
    const player={position:v(),grounded:true,verticalSpeed:0};let apex=0,landed=0;
    for(let i=0;i<fps;i++){
      if(updateJump(player,1/fps,i===0||i===Math.floor(fps*.2)))landed++;
      apex=Math.max(apex,player.position.y);
    }
    assert.ok(apex>.80&&apex<.83);assert.equal(landed,1);assert.equal(player.grounded,true);assert.equal(player.position.y,0);
  }
});

test('airborne locomotion freezes phase and footsteps but combat continues',()=>{
  const avatar=fixture(),a=new CharacterAnimator(avatar);
  for(let i=0;i<60;i++)a.update(1/60,{speed:3.9,weapon:'sword'});
  const phase=a.phase,motion=a.motion,run=a.runBlend;a.events.length=0;
  const action={kind:'sword',combo:0,style:'thrust',height:1.25,progress:0};
  const start=avatar.rig.bones.handR.getWorldPosition(v());
  for(let i=0;i<40;i++){action.progress=i/60;a.update(1/60,{speed:i<20?3.9:0,weapon:'sword',airborne:true,verticalSpeed:2-i*.1,action});}
  assert.equal(a.phase,phase);assert.equal(a.motion,motion);assert.equal(a.runBlend,run);assert.equal(a.events.length,0);
  assert.ok(avatar.rig.bones.handR.getWorldPosition(v()).distanceTo(start)>.1);
  a.update(1/60,{speed:3.9,weapon:'sword',airborne:false});assert.ok(a.phase>phase);
});

test('takeoff loads the legs and landing compresses then recovers',()=>{
  const avatar=fixture(),a=new CharacterAnimator(avatar);
  a.update(1/60,{speed:0,weapon:'unarmed'});const neutral=avatar.rig.bones.hips.position.y;
  a.update(1/60,{speed:0,weapon:'unarmed',takeoffWeight:1});assert.ok(neutral-avatar.rig.bones.hips.position.y>.05);
  a.landing=1;a.landingImpact=1;let lowest=10;
  for(let i=0;i<30;i++){a.update(1/60,{speed:0,weapon:'unarmed'});lowest=Math.min(lowest,avatar.rig.bones.hips.position.y);}
  assert.ok(neutral-lowest>.07);assert.ok(Math.abs(avatar.rig.bones.hips.position.y-neutral)<.003);
});
