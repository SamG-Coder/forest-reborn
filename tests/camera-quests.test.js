import test from 'node:test';
import assert from 'node:assert/strict';
import {PerspectiveCamera,Vector3} from 'three';
import {FollowCamera,loadCameraSettings,cameraSettings} from '../src/game/follow-camera.js';
import {PlayerProgress} from '../src/progression/save.js';
import {questMarkerFor,questLocations} from '../src/progression/quest-markers.js';

test('quest markers follow accept, objective completion, hand-in and restored saves',()=>{
  const entries=new Map(),storage={getItem:k=>entries.get(k),setItem:(k,v)=>entries.set(k,v)},p=new PlayerProgress(storage);
  assert.equal(questMarkerFor('innkeeper',p),'!');assert.equal(questMarkerFor('captain',p),'');
  p.accept('errand');assert.equal(questMarkerFor('innkeeper',p),'');
  p.addItem('flour');p.recordObjective('parcel');assert.equal(questMarkerFor('innkeeper',p),'?');
  assert.equal(questMarkerFor('innkeeper',new PlayerProgress(storage)),'?');
  assert.deepEqual(questLocations([{id:'innkeeper',name:'Tomas',position:{x:4,z:6}}],p),[{id:'innkeeper',name:'Tomas',symbol:'?',x:4,z:6}]);
  p.claim('errand');assert.equal(questMarkerFor('innkeeper',p),'!');p.accept('supper');assert.equal(questMarkerFor('innkeeper',p),'');
  assert.equal(questMarkerFor('innkeeper',{state:q=>q.id==='errand'?'ready':'available'}),'?');
});

test('steady follow keeps the viewing angle, distance and FOV fixed through walk and run cycles',()=>{
  const camera=new PerspectiveCamera(),height=(x,z)=>-5+Math.sin(z*.3)*.8;
  const follow=new FollowCamera(camera,height),player={position:new Vector3()},orbit={cameraYaw:0,cameraPitch:.32,cameraDistance:4.5};
  player.position.set(0,height(0,0),0);follow.update(1/60,player,orbit);const orientation=camera.quaternion.clone();
  for(let i=0;i<600;i++){
    const z=i<240?i/60*1.45:5.8+(i-240)/60*3.9;
    player.position.set(Math.sin(i/60)*.1,height(0,z),z);follow.update(1/60,player,orbit,1);
    assert.ok(camera.quaternion.angleTo(orientation)<1e-7);
    assert.ok(Math.abs(camera.position.distanceTo(follow.aim)-4.5)<1e-7);
    assert.equal(camera.fov,60);
  }
  assert.ok(camera.position.y<0,'no absolute sea-level height clamp');
});

test('jump camera is damped; terrain clearance and teleports preserve a level horizon',()=>{
  const camera=new PerspectiveCamera(),follow=new FollowCamera(camera,()=>0),player={position:new Vector3()},orbit={cameraYaw:.6,cameraPitch:.32,cameraDistance:4.5};
  follow.update(1/60,player,orbit);const start=camera.position.y,q=camera.quaternion.clone();let max=0;
  for(let i=0;i<90;i++){player.position.y=Math.max(0,Math.sin(i/90*Math.PI))*1.1;follow.update(1/60,player,orbit);max=Math.max(max,camera.position.y-start);}
  assert.ok(max<.32&&max>.15);assert.ok(camera.quaternion.angleTo(q)<1e-7);
  player.position.set(200,0,200);follow.update(1/60,player,orbit);assert.ok(Math.abs(follow.focus.x-200)<1e-8);
  follow.height=(x,z)=>z>201?5:0;follow.update(1/60,player,orbit);assert.ok(camera.position.y>=5.45);assert.ok(camera.quaternion.angleTo(q)<1e-7);
});

test('camera preferences tolerate broken saves and clamp extreme input',()=>{
  assert.equal(loadCameraSettings({getItem:()=>'{oops'}).steady,true);
  assert.deepEqual(cameraSettings({fov:200,sensitivity:-1,steady:false,shake:true}),{fov:85,sensitivity:.25,steady:false,shake:true});
});
