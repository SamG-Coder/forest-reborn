import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createBaseRig} from '../src/avatar/rig.js';
import {CharacterAnimator} from '../src/game/animation.js';
import {attachSword,SWORD_GRIP} from '../src/game/weapon-sockets.js';

// Check the actual elbow plane and palm-relative hilt, rather than only checking
// two markers that share a parent. Exercise complete attacks after a moving guard.
test('attack elbows hinge in-plane and the closed palm retains the hilt throughout all poses',()=>{
 for(const fps of [30,60,120])for(const style of ['cut','thrust'])for(let combo=0;combo<3;combo++){
  const root=new T.Group(),rig=createBaseRig(root),animator=new CharacterAnimator({root,rig});
  root.position.set(2,.3,-4);root.rotation.y=.8;
  const sword=new T.Group(),{markers}=attachSword(rig,sword),b=rig.bones;
  for(let i=0;i<fps;i++)animator.update(1/fps,{speed:1.45,weapon:'sword',block:true});
  const action={kind:'sword',style,combo,height:1.25,progress:0};
  for(let i=0;i<=fps;i++){
   action.progress=i/fps;animator.update(1/fps,{speed:1.45,weapon:'sword',action,airborne:i>fps*.3&&i<fps*.6});
   for(const side of ['L','R']){
    const upper=b[`upperArm${side}`],fore=b[`forearm${side}`],hand=b[`hand${side}`];
    const u=fore.getWorldPosition(new T.Vector3()).sub(upper.getWorldPosition(new T.Vector3())).normalize();
    const f=hand.getWorldPosition(new T.Vector3()).sub(fore.getWorldPosition(new T.Vector3())).normalize();
    const rest=fore.position.clone().normalize();
    const hinge=new T.Vector3(0,1,0).addScaledVector(rest,-rest.y).normalize().applyQuaternion(upper.getWorldQuaternion(new T.Quaternion()));
    assert.ok(Math.abs(hinge.dot(u))<1e-6);
    assert.ok(Math.abs(hinge.dot(f))<1e-6,`${side} elbow must not flex sideways`);
   }
   const grip=b.handR.worldToLocal(markers.primaryGrip.getWorldPosition(new T.Vector3()));
   assert.ok(grip.distanceTo(new T.Vector3().fromArray(SWORD_GRIP.position))<1e-7);
   assert.ok(b.handR.quaternion.angleTo(new T.Quaternion())<(style==='thrust'?.20001:1e-6));
   for(const finger of ['index','middle','ring','little']) {
    const segment=rig.segments.find(s=>s.name===`${finger}3R`);
    const tip=b.handR.worldToLocal(b[segment.name].localToWorld(segment.end.clone().sub(segment.start)));
    const socket=sword.userData.socket;
    const axis=new T.Vector3(0,1,0).applyQuaternion(socket.quaternion);
    const delta=tip.sub(socket.position);delta.addScaledVector(axis,-delta.dot(axis));
    assert.ok(delta.length()<.04,'closed fingertips stay around the cylindrical hilt');
   }
   const elbow=root.worldToLocal(b.forearmR.getWorldPosition(new T.Vector3()));
   assert.ok(elbow.x<=-.2749,'elbow clears the ribcage');
  }
 }
});

test('ready guard holds the hilt forward below the chest and the point toward an opponent',()=>{
 const root=new T.Group(),rig=createBaseRig(root),animator=new CharacterAnimator({root,rig});
 const {markers}=attachSword(rig,new T.Group());
 for(let i=0;i<90;i++)animator.update(1/60,{speed:0,weapon:'sword'});
 const hilt=markers.primaryGrip.getWorldPosition(new T.Vector3()),tip=markers.bladeTip.getWorldPosition(new T.Vector3());
 assert.ok(hilt.z>.35&&hilt.z<.60,'hilt in front of torso');
 assert.ok(hilt.y>1.05&&hilt.y<1.25,'hilt below chest, not at face');
 assert.ok(Math.abs(hilt.x)<.23,'hilt near centre line');
 assert.ok(tip.z>hilt.z+.40,'blade points forward');
 assert.ok(tip.y>1.4&&tip.y<1.8,'point rises toward opponent');
 assert.ok(rig.bones.forearmR.getWorldPosition(new T.Vector3()).x<=-.2749);
});
