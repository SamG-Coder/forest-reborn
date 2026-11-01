import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {GearRegistry,createGearRegistry,GEAR_BASES} from '../src/gear/catalog.js';
import {bakeCoverage,applyCoverage,resolveCoverage,MASK_PROFILES,REGIONS,regionAt} from '../src/gear/coverage.js';
import {ClothPatch,projectCapsule} from '../src/gear/cloth.js';
import {crowdLOD,bakeAnimationPalette} from '../src/gear/crowd.js';
import {GarmentDepthCollider} from '../src/gear/collision.js';
import {correctNeckDepth} from '../src/avatar/proportions.js';

test('gear variants inherit one base and mask; slot and mask overrides are rejected',()=>{
  const registry=createGearRegistry(),a=registry.get('clothes.traveller-blue'),b=registry.get('clothes.traveller-red');
  assert.equal(a.base,b.base);assert.equal(a.mask,b.mask);assert.ok(Object.isFrozen(a.base));
  assert.throws(()=>registry.register({id:'bad',base:'tunic',mask:'none'}));assert.throws(()=>registry.register({id:'bad',base:'tunic',slot:'head'}));
  assert.throws(()=>registry.register({id:a.id,base:'tunic'}));assert.throws(()=>new GearRegistry().register({id:'bad',base:'unknown'}));
  for(const base of Object.values(GEAR_BASES))assert.ok(Object.hasOwn(MASK_PROFILES,base.mask));
});
test('jewellery sits above clothes, below armour; boots do not erase upper shins',()=>{
  const r=createGearRegistry(),clothes=r.get('clothes.traveller-blue'),necklace=r.get('jewellery.pendant'),plate=r.get('body.iron-cuirass');
  assert.equal(resolveCoverage([clothes,necklace]).hidden.get(necklace.id),0);
  assert.equal(resolveCoverage([clothes,necklace,plate]).hidden.get(necklace.id),MASK_PROFILES.vest);
  assert.equal(MASK_PROFILES['lower-legs']&regionAt(.11,.48,0),0);
  assert.notEqual(MASK_PROFILES['lower-legs']&regionAt(.11,.25,0),0);
});
test('baked mask hides only completely covered triangles and restores original indices',()=>{
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute([0,1.2,.1,.1,1.2,.1,0,1.3,.1, 0,1.3,.1,.1,1.3,.1,0,1.47,.1],3));
  const baked=bakeCoverage(geometry);assert.equal(applyCoverage(geometry,baked,REGIONS.chest),1);
  assert.equal(applyCoverage(geometry,baked,0),2);assert.deepEqual(Array.from(geometry.index.array),[0,1,2,3,4,5]);
});
test('cloth pins stay attached, stretch is bounded, and capsules exclude points',()=>{
  const g=new THREE.PlaneGeometry(.3,.3,5,5);g.translate(0,1.3,.2);const rest=Array.from({length:36},(_,i)=>new THREE.Vector3().fromBufferAttribute(g.attributes.position,i));let offset=0;
  const patch=new ClothPatch(g,6,6,(i,p)=>p.copy(rest[i]).add(new THREE.Vector3(offset,0,0)));
  for(let i=0;i<180;i++){offset=Math.sin(i/30)*.04;patch.update(1/60,[],2);}
  for(let i=0;i<6;i++)assert.ok(patch.positions[i].distanceTo(rest[i].clone().add(new THREE.Vector3(offset,0,0)))<1e-8);
  assert.ok(patch.maxStretch()<1.12);assert.ok(patch.positions.every(p=>p.toArray().every(Number.isFinite)));
  const p=new THREE.Vector3();projectCapsule(p,{a:new THREE.Vector3(0,-1,0),b:new THREE.Vector3(0,1,0),radius:.2});assert.ok(Math.hypot(p.x,p.z)>=.1999);
});
test('crowd palette contains actual different animation frames and distance tiers',()=>{
  const palette=bakeAnimationPalette(20),data=palette.texture.image.data,width=palette.texture.image.width;
  let delta=0;for(let i=0;i<palette.bones*16;i++)delta+=Math.abs(data[20*width*4+i]-data[30*width*4+i]);
  assert.ok(delta>1);assert.ok(data.every(Number.isFinite));assert.equal(crowdLOD(10),0);assert.equal(crowdLOD(30),1);assert.equal(crowdLOD(100),2);palette.texture.dispose();
});

test('neck posture correction preserves jaw width, height, and facial features',()=>{
  const values=[];
  for(const y of [1.44,1.50,1.54,1.58,1.60,1.66,1.73])for(const x of [-.08,0,.08])for(const z of [-.10,0,.06])values.push(x,y,z);
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(values,3));
  const before=geometry.attributes.position.array.slice();correctNeckDepth(geometry);const after=geometry.attributes.position.array;
  for(let i=0;i<before.length;i+=3){
    assert.equal(after[i],before[i]);assert.equal(after[i+1],before[i+1]);
    if(before[i+1]>=1.58&&before[i+2]>=-.025||before[i+1]>=1.65)assert.equal(after[i+2],before[i+2]);
  }
});

test('cloth layer contact follows the inner garment without trapping its side seams',()=>{
  const geometry=new THREE.BoxGeometry(.3,.4,.2);geometry.translate(0,1,0);
  const collider=new GarmentDepthCollider();collider.update([new THREE.Mesh(geometry)]);
  const front=new THREE.Vector3(0,.95,0),back=front.clone(),outside=new THREE.Vector3(.3,.95,0);
  collider.project(front,1);collider.project(back,-1);collider.project(outside,1);
  assert.ok(front.z>.108&&front.z<.111);assert.ok(back.z<-.108&&back.z>-.111);assert.equal(outside.z,0);
});
