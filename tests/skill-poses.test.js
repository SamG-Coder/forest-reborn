import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createBaseRig} from '../src/avatar/rig.js';
import {CharacterAnimator} from '../src/game/animation.js';
import {JobAnimation} from '../src/npc/job-animation.js';

test('gathering, mining and town jobs animate finite poses and keep tools parented to the hand',()=>{
  for(const activity of ['gather','collect','mine','hammer','drink','carry','read','trade','serve','sort','wipe']){
    const root=new THREE.Group(),rig=createBaseRig(root),avatar={root,rig};
    const base=new CharacterAnimator(avatar),jobs=new JobAnimation(avatar),poses=[];
    for(let i=0;i<150;i++){
      base.update(1/60,{speed:0,weapon:'unarmed',grounding:false});jobs.update(1/60,activity,false);
      for(const bone of rig.skeleton.bones)assert.ok(bone.quaternion.toArray().every(Number.isFinite),activity+' '+bone.name);
      if(i===70||i===149)poses.push(rig.bones.handR.getWorldPosition(new THREE.Vector3()));
    }
    assert.ok(poses[1].distanceTo(new THREE.Vector3(-.84,1.418,0))>.15,activity+' must leave bind pose');
    for(const prop of Object.values(jobs.props))assert.equal(prop.parent,rig.bones.handR);
    jobs.clear();assert.ok(Object.values(jobs.props).every(prop=>!prop.visible));
  }
});
