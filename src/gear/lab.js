import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {createMaleAvatar} from '../avatar/model.js';
import {CharacterAnimator} from '../game/animation.js';
import {equipPracticeSword} from '../game/equipment.js';
import {GEAR_SLOTS,createGearRegistry,STARTER_GEAR} from './catalog.js';
import {loadGearMaterials} from './materials.js';
import {LayeredEquipment} from './equipment.js';
import {createVariationEditor} from './variation-editor.js';
import {createHairSystem,HAIR_STYLES} from '../hair/system.js';
import './lab.css';

const $=s=>document.querySelector(s),view=$('#view');
const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));view.append(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color('#dbe1d8');
const camera=new THREE.PerspectiveCamera(34,1,.02,80);camera.position.set(2.1,1.55,3.1);
const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,.98,0);controls.enableDamping=true;
scene.add(new THREE.HemisphereLight('#fff7e7','#597569',2));const light=new THREE.DirectionalLight('#fff1d3',2.6);light.position.set(-3,5,4);scene.add(light);
const pmrem=new THREE.PMREMGenerator(renderer),environment=pmrem.fromScene(new RoomEnvironment(),.04);scene.environment=environment.texture;pmrem.dispose();
scene.add(new THREE.GridHelper(8,32,'#9dae9e','#c5cfc0'));
const avatar=await createMaleAvatar(),materials=await loadGearMaterials(),registry=createGearRegistry();scene.add(avatar.root);
const equipment=new LayeredEquipment(avatar,registry,materials),animator=new CharacterAnimator(avatar),weapon=equipPracticeSword(avatar);
const hair=await createHairSystem(avatar,equipment.templates.helmet);hair.setStyle('swept');
for(const [id,label]of Object.entries(HAIR_STYLES))$('#hair-preview').add(new Option(label,id));$('#hair-preview').value='swept';
$('#hair-preview').onchange=()=>{hair.setStyle($('#hair-preview').value);hair.setHeadwear(equipment.entries.get('head')?.definition);};
$('#hair-tint').oninput=()=>hair.setColor($('#hair-tint').value);
equipment.apply(STARTER_GEAR);
for(const [id,label] of Object.entries(GEAR_SLOTS)){
  const wrap=document.createElement('label');wrap.textContent=label;const select=document.createElement('select');select.dataset.slot=id;select.add(new Option('None',''));
  for(const item of registry.list(id))select.add(new Option(item.name,item.id));select.onchange=()=>{try{if(select.value)equipment.equip(select.value);else equipment.unequip(id);sync();}catch(e){$('#status').textContent=e.message;}};wrap.append(select);$('#slots').append(wrap);
}
function sync(){
  for(const select of document.querySelectorAll('[data-slot]')){
    for(const option of select.querySelectorAll('[data-generated]'))option.remove();
    const item=equipment.entries.get(select.dataset.slot)?.definition;
    if(item&&!Array.from(select.options).some(option=>option.value===item.id)){const option=new Option(item.name,item.id);option.dataset.generated='true';select.add(option);}
    select.value=item?.id??'';
  }
  $('#status').textContent='Ready · orbit and zoom to inspect';
}
sync();
for(const button of document.querySelectorAll('[data-preset]'))button.onclick=()=>{
  const type=button.dataset.preset,ids=type==='bare'?[]:[...STARTER_GEAR];
  if(type==='mail')ids.push('body.riveted-mail');if(type==='plate')ids.push('body.iron-cuirass','head.iron-open');equipment.apply(ids);sync();
};
$('#physics').onchange=()=>equipment.simulate=$('#physics').checked;$('#wind').oninput=()=>equipment.wind=Number($('#wind').value);
$('#wire').onchange=()=>{avatar.root.traverse(o=>{if(o.isMesh)o.material.wireframe=$('#wire').checked;});};
let time=0,last=performance.now(),mode='idle',action=null,cycle=-1;
$('#animation').onchange=()=>{mode=$('#animation').value;time=0;cycle=-1;action=null;};
function advance(dt){
  time+=dt;const current=Math.floor(time/1.3),phase=(time%1.3)/1.3;
  if(['slash','thrust','punch'].includes(mode)){if(current!==cycle){action={kind:mode==='punch'?'punch':'sword',style:mode==='thrust'?'thrust':'cut',combo:current%3,side:current%2?'L':'R',height:1.25,progress:0};cycle=current;}action.progress=phase;}else action=null;
  const airborne=mode==='jump'&&phase>.12&&phase<.86;
  avatar.root.position.y=airborne?Math.sin((phase-.12)/.74*Math.PI)*.6:0;
  weapon.sword.visible=mode!=='punch';
  animator.update(dt,{speed:mode==='run'?3.9:mode==='walk'?1.45:0,weapon:mode==='punch'?'unarmed':'sword',block:mode==='guard',action,airborne,verticalSpeed:airborne?Math.cos((phase-.12)/.74*Math.PI)*3:0,grounding:false});
  equipment.update(dt);
}
function resize(){renderer.setSize(view.clientWidth,view.clientHeight);camera.aspect=view.clientWidth/view.clientHeight;camera.updateProjectionMatrix();}new ResizeObserver(resize).observe(view);resize();
renderer.setAnimationLoop(()=>{const now=performance.now(),dt=Math.min(.05,(now-last)/1000)*Number($('#speed').value);last=now;advance(dt);controls.update();renderer.render(scene,camera);const s=equipment.stats();$('#stats').textContent=`${s.items} items · ${s.clothParticles} cloth particles\nStretch ${s.maxStretch.toFixed(2)}× · ${renderer.info.render.calls} draws\n${renderer.info.render.triangles.toLocaleString()} triangles`;});
const variations=createVariationEditor({root:$('#variations'),equipment,weapon,onChange:sync});
window.gearLab={ready:true,avatar,equipment,registry,animator,renderer,scene,camera,advance,variations,setMode(value){$('#animation').value=value;$('#animation').dispatchEvent(new Event('change'));}};
