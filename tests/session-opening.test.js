import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {SaveLibrary, SAVE_KEYS} from '../src/session/save-library.js';
import {createBaseRig} from '../src/avatar/rig.js';
import {phonePose} from '../src/cinematic/poses.js';
import {PHONE_ATTACHMENT} from '../src/cinematic/phone-grip.js';
import {carMotionAt, avoidanceAt} from '../src/cinematic/approach-motion.js';
import {frameAttachment} from '../src/cinematic/shot-track.js';
import {openingTrack} from '../src/cinematic/opening-script.js';

function storage() {
  const values = new Map();
  return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)};
}
test('save slots isolate every persisted system and deleting one keeps other characters', () => {
  const store=storage();let id=0;
  const saves=new SaveLibrary(store,{id:()=>String(++id)}),first=saves.create('Arin'),second=saves.create('Kellan');
  for(const key of SAVE_KEYS){saves.slot(first.id).setItem(key,'first:'+key);saves.slot(second.id).setItem(key,'second:'+key);}
  saves.update(first.id,{stage:'world',level:3,playSeconds:180});
  const restored=new SaveLibrary(store);
  assert.equal(restored.list().find(s=>s.id===first.id).stage,'world');
  restored.remove(second.id);
  for(const key of SAVE_KEYS)assert.equal(restored.slot(first.id).getItem(key),'first:'+key);
  assert.throws(()=>restored.slot(second.id));
  assert.equal(new SaveLibrary(store).list().length,1);
});
test('legacy progress migrates once without removing the original saved data', () => {
  const store=storage();
  store.setItem(SAVE_KEYS[0],JSON.stringify({level:8,coins:143}));store.setItem(SAVE_KEYS[1],JSON.stringify({name:'Ren'}));store.setItem(SAVE_KEYS[2],'original world');
  const before=SAVE_KEYS.map(key=>store.getItem(key));
  const saves=new SaveLibrary(store,{id:()=> 'legacy'});
  assert.equal(saves.list()[0].stage,'world');assert.equal(saves.list()[0].level,8);
  for(let i=0;i<SAVE_KEYS.length;i++){assert.equal(store.getItem(SAVE_KEYS[i]),before[i]);assert.equal(saves.slot('legacy').getItem(SAVE_KEYS[i]),before[i]);}
  assert.equal(new SaveLibrary(store).list().length,1);
});
test('open phone hand stays behind the screen with an unbent wrist through the walk', () => {
  for(const yaw of [0,1.3,Math.PI])for(const scale of [.91,1,1.08]){
    const root=new THREE.Group(),avatar={root,rig:createBaseRig(root)};
    root.rotation.y=yaw;root.scale.setScalar(scale);
    const phone=new THREE.Object3D();phone.position.fromArray(PHONE_ATTACHMENT.position);phone.rotation.set(...PHONE_ATTACHMENT.rotation);avatar.rig.bones.handR.add(phone);
    phonePose(avatar,14);root.updateMatrixWorld(true);
    assert.ok(avatar.rig.bones.handR.quaternion.angleTo(new THREE.Quaternion())<1e-6);
    for(const finger of ['index','middle','ring','little','thumb'])for(let joint=1;joint<=(finger==='thumb'?2:3);joint++){
      const bone=avatar.rig.bones[`${finger}${joint}R`];
      assert.ok(bone.quaternion.angleTo(new THREE.Quaternion())<1e-6);
      assert.ok(phone.worldToLocal(bone.getWorldPosition(new THREE.Vector3())).z < 0,`${finger} behind screen`);
    }
    const camera=new THREE.PerspectiveCamera(36,1.6,.05,450);
    frameAttachment(camera,phone,{position:[.32,.4,.3]});camera.updateMatrixWorld(true);
    const centre=phone.localToWorld(new THREE.Vector3()).project(camera),top=phone.localToWorld(new THREE.Vector3(0,.07,0)).project(camera);
    assert.ok(top.y>centre.y,'Phone text stays upright in the close-up');
    openingTrack.apply(camera,19);assert.deepEqual(camera.up.toArray(),[0,1,0]);
  }
});
test('car drives straight at the faster speed and reaches the character after the backstep', () => {
  for(const t of [0,3,8,14,16.99])assert.equal(carMotionAt(t).visible,false);
  assert.equal(carMotionAt(17).visible,true);
  for(let t=17;t<=23.3;t+=.01){const next=carMotionAt(t);assert.equal(next.x,1.1);assert.equal(next.yaw,0);}
  assert.ok(Math.abs(carMotionAt(22).z-carMotionAt(21).z-10.6)<1e-9);
  const car=carMotionAt(23.3),attempt=avoidanceAt(23.3),dx=.6+attempt.step*.68-car.x,dz=-.7+attempt.step*.14-car.z;
  const localX=Math.cos(car.yaw)*dx-Math.sin(car.yaw)*dz,localZ=Math.sin(car.yaw)*dx+Math.cos(car.yaw)*dz;
  assert.ok(Math.abs(localX)<1&&localZ>1.5&&localZ<2.3,'front corner contacts the character before the cut');
  assert.equal(avoidanceAt(21).step,0);assert.equal(attempt.step,1);
});
