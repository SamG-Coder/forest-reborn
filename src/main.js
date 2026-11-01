import * as THREE from 'three';
import {loadMaterials} from './materials.js';
import {createMaleModel} from './model/male.js';
import {poseRig} from './model/animation.js';
import {createItemRegistry,STARTER_OUTFIT,SLOTS} from './items/registry.js';
import {Equipment} from './items/equipment.js';
import {createPreviewScene} from './preview/scene.js';
import {mountUI} from './preview/ui.js';
import {exportModel,download} from './preview/export.js';
import './style.css';
import '@fontsource/dm-sans/400.css';
import '@fontsource/dm-sans/500.css';
import '@fontsource/dm-sans/600.css';
import '@fontsource/manrope/600.css';
import '@fontsource/manrope/800.css';

const registry=createItemRegistry(),ui=mountUI(document.querySelector('#app'),registry);
const $=selector=>document.querySelector(selector);
const STORAGE_KEY='forest-reborn-male-outfit-v1';

async function start(){
 const materials=await loadMaterials(),model=createMaleModel(materials),equipment=new Equipment(model,registry);
 equipment.apply([]);
 const preview=createPreviewScene($('#viewport'));preview.scene.add(model.root);preview.setView('face');
 const helper=new THREE.SkeletonHelper(model.root);helper.material.depthTest=false;helper.material.transparent=true;helper.material.opacity=.85;helper.renderOrder=10;helper.visible=false;preview.scene.add(helper);
 let selected='coat.traveller-teal',isolated=false,animation='bind',playing=true,turntable=false,animationTime=0,speed=1,exporting=false;
 const clock=new THREE.Clock();
 function persist(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify({version:1,modelId:model.id,items:equipment.ids()}));}catch{ui.toast('Browser storage is unavailable. You can still export the outfit.');}}
 function visibility(){
  const covered=new Set();for(const {definition} of equipment.equipped.values())for(const region of definition.covers)covered.add(region);
  model.setCoveredRegions(covered);
  for(const meshes of model.bodyParts.values())for(const mesh of meshes)if(isolated)mesh.visible=false;
  for(const {definition,group} of equipment.equipped.values())group.visible=!isolated||definition.id===selected;
 }
 function stats(){
  let meshes=0,triangles=0;model.root.traverseVisible(object=>{if(object.isMesh){meshes++;triangles+=(object.geometry.index?.count??object.geometry.attributes.position.count)/3;}});
  $('#stat-meshes').textContent=meshes;$('#stat-triangles').textContent=Math.round(triangles).toLocaleString();$('#stat-bones').textContent=model.rig.skeleton.bones.length;$('#stat-items').textContent=equipment.ids().length;
  $('.branch-line').lastElementChild.textContent=[...model.bodyParts.values()].reduce((total,parts)=>total+parts.length,0)+' parts';
  $('#status').textContent=`${model.id} · ${meshes} visible meshes · ${model.rig.skeleton.bones.length} bones · ${equipment.ids().length} equipped items`;
 }
 function refresh(){
  visibility();ui.refreshEquipment(equipment,selected);stats();
  const definition=registry.get(selected);$('#selected-name').textContent=definition.name;$('#selected-description').textContent=definition.description;$('#selected-id').textContent=definition.id;$('#selected-slot').textContent=SLOTS[definition.slot];
  $('#isolate').textContent=isolated?'Show complete model':'Isolate selected item';$('#isolate').classList.toggle('active',isolated);
  $('#outfit-name').textContent=isolated?definition.name:equipment.ids().length===0?'Male base body':'Male · '+(equipment.equipped.has('outerwear')?'traveller outfit':'custom outfit');
  $('#outfit-detail').textContent=isolated?'Isolated mesh group · shared skeleton':equipment.ids().length===0?'Original generated face UV · shaped head mesh':'Separate meshes. One connected skeleton.';
  if(equipment.ids().length===0){
   $('#selected-name').textContent='Male head surface';$('#selected-description').textContent='The original generated face image is UV-wrapped onto the shaped head. Eyes, brows, and mouth are painted in the texture.';
   $('#selected-id').textContent='male_head_surface';$('#selected-slot').textContent='Base model / head';
  }
  $('#isolate').hidden=equipment.ids().length===0;
  $('#view-label').textContent=isolated?'Item isolation':'Preview';
 }
 document.addEventListener('click',event=>{
  const itemButton=event.target.closest('[data-item]'),selectButton=event.target.closest('[data-select]'),removeButton=event.target.closest('[data-unequip]'),viewButton=event.target.closest('[data-view]');
  if(itemButton){
   const id=itemButton.dataset.item,definition=registry.get(id);selected=id;
   if(definition.slot!=='hair'&&equipment.equipped.get(definition.slot)?.definition.id===id)equipment.unequip(definition.slot);else equipment.equip(id);
   isolated=false;refresh();persist();
  }
  if(selectButton){selected=selectButton.dataset.select;refresh();}
  if(removeButton){equipment.unequip(removeButton.dataset.unequip);isolated=false;refresh();persist();}
  if(viewButton)preview.setView(viewButton.dataset.view);
 });
 $('#base-body').onclick=()=>{equipment.apply([]);isolated=false;refresh();persist();ui.toast('Base male body. No items equipped.');};
 $('#starter-outfit').onclick=()=>{equipment.apply(STARTER_OUTFIT);selected='coat.traveller-teal';isolated=false;refresh();persist();ui.toast('Starter outfit equipped.');};
 $('#skeleton').onchange=event=>helper.visible=event.target.checked;
 $('#wireframe').onchange=event=>{for(const value of Object.values(materials))if(value?.isMaterial)value.wireframe=event.target.checked;};
 $('#grid').onchange=event=>preview.grid.visible=event.target.checked;
 $('#isolate').onclick=()=>{if(!equipment.equipped.has(registry.get(selected).slot)||equipment.equipped.get(registry.get(selected).slot).definition.id!==selected)equipment.equip(selected);isolated=!isolated;refresh();};
 $('#animation').onchange=event=>{animation=event.target.value;animationTime=0;};
 $('#speed').onchange=event=>speed=Number(event.target.value);
 $('#play').onclick=()=>{playing=!playing;$('#play').textContent=playing?'Ⅱ':'▶';$('#play').title=playing?'Pause animation':'Play animation';};
 $('#turntable').onclick=()=>{turntable=!turntable;$('#turntable').classList.toggle('active',turntable);preview.controls.autoRotate=turntable;preview.controls.autoRotateSpeed=.65;};
 $('#save-outfit').onclick=()=>{download(JSON.stringify({version:1,modelId:model.id,rigId:model.rig.id,items:equipment.ids()},null,2),'male-outfit.json','application/json');ui.toast('Outfit exported as registered item IDs.');};
 $('#export').onclick=async()=>{
  if(exporting)return;exporting=true;$('#export').disabled=true;$('#export').textContent='Exporting…';
  const previousIsolation=isolated;isolated=false;visibility();
  try{const data=await exportModel(model,equipment);download(data,'male-equipped.glb','model/gltf-binary');ui.toast('Exported meshes, textures, skeleton, and four animations.');}
  catch(error){console.error(error);ui.toast(`Export failed: ${error.message}`);}
  finally{isolated=previousIsolation;visibility();exporting=false;$('#export').disabled=false;$('#export').innerHTML='Export model <span>↗</span>';}
 };
 refresh();$('#animation').value='bind';$('#loading').classList.add('hidden');
 function frame(){requestAnimationFrame(frame);const delta=Math.min(clock.getDelta(),.05);if(playing&&!exporting)animationTime+=delta*speed;
  if(!exporting)poseRig(model.rig,animation,animationTime);model.root.updateMatrixWorld(true);model.rig.skeleton.update();helper.updateMatrixWorld(true);
  $('#timeline-progress').style.width=`${(animationTime%(animation==='attack'?1.15:4))/(animation==='attack'?1.15:4)*100}%`;preview.render();
 }frame();
 // Read-only inspection API for local integration tests; no production gameplay hooks.
 if(import.meta.env.DEV)window.__modelPreview={model,equipment,registry,preview,getState:()=>({modelId:model.id,rigId:model.rig.id,items:equipment.ids(),animation,playing,isolated,bones:model.rig.skeleton.bones.length}),exportModel:()=>exportModel(model,equipment)};
}
start().catch(error=>{console.error(error);$('#loading').textContent=`Unable to open the preview: ${error.message}`;$('#status').textContent='Preview failed to load.';});
