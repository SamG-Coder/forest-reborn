import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createBaseRig} from '../src/avatar/rig.js';
import {createNPCPalette} from '../src/graphics/npc-palette.js';
import {npcLOD} from '../src/graphics/npc-instances.js';
import {RagdollPose,RagdollAtlas} from '../src/npc/ragdoll.js';
import {CharacterAnimator} from '../src/game/animation.js';
import {attachSword,SWORD_GRIP} from '../src/game/weapon-sockets.js';
import {gridSurfaceHeight} from '../src/graphics/height-surface.js';
import {twoHandCutFrame,sampleTwoHandCut} from '../src/game/weapon-motion.js';
import {MountController} from '../src/mounts/controller.js';

test('all weapon families retain exactly the base walk and run lower-body matrices',()=>{
  const p=createNPCPalette();
  for(const name of ['hips','thighL','shinL','footL','thighR','shinR','footR']){
    const index=p.rig.segments.find(s=>s.name===name).index;
    for(const clip of [1,2])for(const base of [6,12,18])for(let f=0;f<p.frames;f++){
      const a=(clip*p.frames+f)*p.width*4+index*16,b=((clip+base)*p.frames+f)*p.width*4+index*16;
      assert.deepEqual(p.data.slice(a,a+16),p.data.slice(b,b+16),`${name}, clip ${clip+base}, frame ${f}`);
    }
  }
  p.texture.dispose();p.rig.skeleton.dispose();
});

test('both palms remain on the two-hand hilt or spear shaft throughout gait and attacks',()=>{
  for(const weapon of ['weapon.spear','weapon.greatsword'])for(const scale of [.94,1.06]){
    const root=new THREE.Group(),rig=createBaseRig(root),sword=new THREE.Group();root.scale.setScalar(scale);root.rotation.y=.73;attachSword(rig,sword);
    const animator=new CharacterAnimator({root,rig});
    for(const combo of [0,1])for(const speed of [0,1.45,3.9])for(let f=0;f<=80;f++){
      animator.update(1/60,{speed,weapon,grounding:false,scrubPhase:f/80,action:f<40?null:{kind:'sword',combo,progress:(f-40)/40,height:1.2}});
      root.updateMatrixWorld(true);
      const palm=rig.bones.handL.localToWorld(new THREE.Vector3(-SWORD_GRIP.position[0],SWORD_GRIP.position[1],SWORD_GRIP.position[2]));
      const handle=sword.localToWorld(new THREE.Vector3(0,weapon==='weapon.spear'?.24:-.22,0));
      assert.ok(palm.distanceTo(handle)<.004,`${weapon}, speed ${speed}, frame ${f}: ${palm.distanceTo(handle)}`);
      const right=rig.bones.handR.localToWorld(new THREE.Vector3(...SWORD_GRIP.position));
      assert.ok(right.distanceTo(sword.userData.markers.primaryGrip.getWorldPosition(new THREE.Vector3()))<1e-6);
    }
  }
});

test('greatsword overhead and sweep lead with the cutting edge, not a flat face',()=>{
  for(const combo of [0,1])for(let p=.28;p<.55;p+=.015){
    const pose=twoHandCutFrame(p,combo),before=sampleTwoHandCut(p-.002,combo),after=sampleTwoHandCut(p+.002,combo);
    const velocity=after.grip.addScaledVector(after.blade,.95).sub(before.grip.addScaledVector(before.blade,.95)).projectOnPlane(pose.blade).normalize();
    assert.ok(Math.abs(pose.edge.dot(velocity))>.999);assert.ok(Math.abs(pose.edge.dot(pose.blade))<1e-6);
  }
  assert.ok(sampleTwoHandCut(.55,0).blade.y<0,'overhead finishes pointing down');
  assert.ok(sampleTwoHandCut(.28,1).blade.x*sampleTwoHandCut(.55,1).blade.x<0,'sweep crosses the opponent');
});

test('mounted weapon animations retain both grips and do not pull feet out of the riding pose',()=>{
  for(const weapon of ['sword','weapon.shortshield','weapon.greatsword','weapon.spear']){
    const root=new THREE.Group(),rig=createBaseRig(root),avatar={root,rig},sword=new THREE.Group();attachSword(rig,sword);
    const player={position:new THREE.Vector3(),yaw:.43,speed:8.4,grounded:true};
    const mount=new MountController({avatar,player});mount.mounted=true;mount.horse={root:new THREE.Group(),body:new THREE.Group(),seatHeight:1.3,update(){}};
    const animator=new CharacterAnimator(avatar);let feet=null;
    for(const combo of [0,1])for(let f=0;f<=40;f++){
      const state={weapon,speed:0,grounding:false,action:{kind:'sword',combo,progress:f/40,aimSide:-1}};
      root.position.set(0,0,0);root.rotation.y=player.yaw;animator.update(1/60,state);mount.update(1/60,state);root.updateMatrixWorld(true);
      for(const side of ['L','R']){const foot=root.worldToLocal(rig.bones['foot'+side].getWorldPosition(new THREE.Vector3()));assert.ok(Math.abs(foot.x-(side==='L'?.43:-.43))<1e-4);}
      const palm=rig.bones.handR.localToWorld(new THREE.Vector3(...SWORD_GRIP.position));
      assert.ok(palm.distanceTo(sword.userData.markers.primaryGrip.getWorldPosition(new THREE.Vector3()))<1e-6);
      if(weapon==='weapon.spear'){
        const left=rig.bones.handL.localToWorld(new THREE.Vector3(-SWORD_GRIP.position[0],SWORD_GRIP.position[1],SWORD_GRIP.position[2]));
        assert.ok(left.distanceTo(sword.localToWorld(new THREE.Vector3(0,weapon==='weapon.spear'?.24:-.22,0)))<.005);
      }
    }
  }
});

test('ragdoll settles on terrain then stops changing or uploading its frozen pose',()=>{
  const root=new THREE.Group(),rig=createBaseRig(root);rig.skeleton.update();
  const options={matrices:rig.skeleton.boneMatrices,origin:new THREE.Vector3(2,.2,3),height:(x,z)=>x*.1,impulse:new THREE.Vector3(2,0,1)};
  const pose=new RagdollPose(options);for(let i=0;i<300;i++)pose.update(1/60);
  assert.ok(pose.settled);const before=[...pose.matrices];assert.equal(pose.update(10),false);assert.deepEqual([...pose.matrices],before);
  for(const p of pose.points.values())assert.ok(p.position.y>=options.height(p.position.x,p.position.z)+p.radius-1e-6);
  const atlas=new RagdollAtlas(256,2);atlas.add('body',options);for(let i=0;i<300;i++)atlas.update(1/60);
  assert.equal(atlas.active,0);const version=atlas.texture.version;atlas.update(1);assert.equal(atlas.texture.version,version);atlas.dispose();
});

test('distance LOD promotes every close individual, with boundary hysteresis',()=>{
  assert.equal(npcLOD(3,2),0);assert.equal(npcLOD(20,0),0);assert.equal(npcLOD(22,0),1);assert.equal(npcLOD(60,1),2);assert.equal(npcLOD(40,2),1);
});

test('decal height follows the same triangles as the visible ground mesh',()=>{
  const h=(x,z)=>x*z,s=gridSurfaceHeight(h,{step:1});
  assert.equal(s(.2,.3),0);assert.ok(Math.abs(s(.8,.7)-.5)<1e-6);assert.equal(s(1,1),1);
});
