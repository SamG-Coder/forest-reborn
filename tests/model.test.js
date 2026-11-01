import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createMaleModel} from '../src/model/male.js';
import {createItemRegistry,STARTER_OUTFIT,ItemRegistry} from '../src/items/registry.js';
import {Equipment} from '../src/items/equipment.js';
import {poseRig,createAnimationClips} from '../src/model/animation.js';
import {faceUV,faceDepth} from '../src/model/head.js';

function fixture(){const material=new THREE.MeshBasicMaterial();const materials=Object.fromEntries(['skin','face','hair','shirt','coat','pants','leather','gold','steel'].map(name=>[name,material]));const model=createMaleModel(materials),registry=createItemRegistry();return {model,registry,equipment:new Equipment(model,registry)};}
test('head retains face UV material with no separate facial-feature meshes',()=>{
 const {model}=fixture();const head=model.root.getObjectByName('male_head_surface');assert.equal(head.material[0],model.materials.face);assert.equal(head.material[1],model.materials.face);
 model.root.traverse(object=>assert.ok(!/^(eye_white|iris_|brow_|mouth_seam|nostril_)/.test(object.name)));
 const uv=head.geometry.attributes.uv;for(let i=0;i<uv.count;i++){assert.ok(uv.getX(i)>=0&&uv.getX(i)<=1);assert.ok(uv.getY(i)>=0&&uv.getY(i)<=1);}
 assert.equal(faceUV(0,2.535)[1],.25);assert.equal(faceUV(0,2.735)[1],.55);
 assert.ok(faceDepth(0,2.63)>faceDepth(0,2.78)+.025,'nose must exist in the profile geometry');
});
test('base male is independent of equipment and owns one common skeleton',()=>{
 const {model}=fixture();assert.equal(model.id,'male-v1');assert.equal(model.rig.skeleton.bones.length,19);
 model.root.traverse(object=>{if(object.isMesh)assert.equal(object.skeleton,model.rig.skeleton);});assert.ok(!model.root.getObjectByName('weapon.iron-sword'));
});
test('equipped meshes all use normalized weights and valid shared bone indices',()=>{
 const {model,equipment}=fixture();equipment.apply(STARTER_OUTFIT);
 model.root.traverse(object=>{if(!object.isSkinnedMesh)return;assert.equal(object.skeleton,model.rig.skeleton);const w=object.geometry.attributes.skinWeight,i=object.geometry.attributes.skinIndex;
  for(let n=0;n<w.count;n++){assert.ok(Math.abs(w.getX(n)+w.getY(n)+w.getZ(n)+w.getW(n)-1)<1e-6);assert.ok(i.getX(n)<19);assert.ok(i.getY(n)<19);}
 });
});
test('swapping hairstyle disposes the old geometry and does not replace the body or rig',()=>{
 const {model,equipment}=fixture();equipment.equip('hair.swept-black');const old=equipment.equipped.get('hair').group,head=model.rig.bones.head;let disposed=0;old.traverse(mesh=>{if(mesh.isMesh)mesh.geometry.addEventListener('dispose',()=>disposed++);});
 equipment.equip('hair.short-black');assert.equal(model.rig.bones.head,head);assert.equal(old.parent,null);assert.ok(disposed>0);assert.deepEqual(equipment.ids(),['hair.short-black']);
});
test('unequipping clothing restores its covered body regions',()=>{
 const {model,equipment}=fixture();equipment.equip('shirt.linen-ivory');assert.equal(model.bodyParts.get('torso')[0].visible,false);equipment.unequip('shirt');assert.equal(model.bodyParts.get('torso')[0].visible,true);
});
test('invalid IDs and incompatible rigs do not replace existing items',()=>{
 const {equipment,registry}=fixture();equipment.equip('hair.swept-black');assert.throws(()=>equipment.equip('missing'),/not registered/);
 registry.register({id:'wrong',slot:'hair',models:['another-body'],rigId:'different-rig',build(){}});assert.throws(()=>equipment.equip('wrong'),/not compatible/);assert.deepEqual(equipment.ids(),['hair.swept-black']);
});
test('duplicate registration and slot collisions are rejected',()=>{
 const {registry,equipment}=fixture();assert.throws(()=>registry.register(registry.get('hair.swept-black')),/Duplicate/);assert.throws(()=>equipment.apply(['hair.swept-black','hair.short-black']),/Two items/);assert.throws(()=>new ItemRegistry().register({id:'bad',slot:'mystery'}),/Unknown slot/);
});
test('head-bound hair follows its head when animated; skinned vertices stay finite',()=>{
 const {model,equipment}=fixture();equipment.apply(STARTER_OUTFIT);const hair=equipment.equipped.get('hair').group.children[0];
 model.rig.reset();model.root.updateMatrixWorld(true);model.rig.skeleton.update();const a=hair.getVertexPosition(0,new THREE.Vector3());model.rig.bones.head.rotation.y=.8;model.root.updateMatrixWorld(true);model.rig.skeleton.update();const b=hair.getVertexPosition(0,new THREE.Vector3());assert.ok(a.distanceTo(b)>.05);
 for(const mode of ['walk','run','attack']){poseRig(model.rig,mode,.4);model.root.updateMatrixWorld(true);model.rig.skeleton.update();model.root.traverse(object=>{if(object.isSkinnedMesh){const v=object.getVertexPosition(0,new THREE.Vector3());assert.ok(v.toArray().every(Number.isFinite));}});}
});
test('portable animation clips target registered bones and have finite keyframes',()=>{
 const {model}=fixture();const clips=createAnimationClips(model);assert.deepEqual(clips.map(clip=>clip.name),['idle','walk','run','attack']);for(const clip of clips){assert.ok(clip.duration>0);for(const track of clip.tracks){assert.ok(model.rig.bones[track.name.split('.')[0]]);assert.ok([...track.values].every(Number.isFinite));}}
});
