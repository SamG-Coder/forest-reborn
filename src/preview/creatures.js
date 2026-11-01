import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {createMaleAvatar} from '../avatar/model.js';
import {loadGearMaterials} from '../gear/materials.js';
import {createGearRegistry} from '../gear/catalog.js';
import {LayeredEquipment} from '../gear/equipment.js';
import {createHumanoid} from '../npc/humanoid.js';
import {GOBLIN_SCALE,GOBLIN_SKINS,goblinOutfit} from '../npc/goblin.js';
import {createRabbit} from '../npc/rabbit.js';

const canvas=document.querySelector('#preview'),renderer=new THREE.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;
const scene=new THREE.Scene();scene.background=new THREE.Color('#dce2d5');scene.fog=new THREE.Fog('#dce2d5',7,20);
scene.add(new THREE.HemisphereLight('#fff5df','#60765a',2));
const sun=new THREE.DirectionalLight('#fff4d8',2.5);sun.position.set(-3,6,4);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-4,right:4,top:4,bottom:-4,near:.2,far:15});sun.shadow.normalBias=.015;scene.add(sun);
const fill=new THREE.DirectionalLight('#d5ebff',.7);fill.position.set(4,2,-3);scene.add(fill);
const ground=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.MeshStandardMaterial({color:'#b7c5a7',roughness:1}));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);
const camera=new THREE.PerspectiveCamera(32,1,.01,80),controls=new OrbitControls(camera,canvas);controls.enableDamping=true;controls.minDistance=.6;controls.maxDistance=10;controls.maxPolarAngle=Math.PI*.48;
const rabbitGroup=new THREE.Group(),goblinGroup=new THREE.Group();scene.add(rabbitGroup,goblinGroup);goblinGroup.visible=false;
const rabbits=Array.from({length:4},(_,i)=>{const rabbit=createRabbit({variant:i});rabbit.root.position.set((i-1.5)*.64,0,i%2*.09);rabbit.root.rotation.y=i%2?.35:-.25;rabbitGroup.add(rabbit.root);return rabbit;});
const [template,materials]=await Promise.all([createMaleAvatar(),loadGearMaterials()]),registry=createGearRegistry();
const baseWardrobe=new LayeredEquipment(template,registry,materials);template.gearTemplates=baseWardrobe.templates;template.baseIndices=baseWardrobe.bodyCoverage.original;
const goblins=await Promise.all(Array.from({length:3},(_,i)=>createHumanoid(template,registry,materials,{kind:'goblin',skin:GOBLIN_SKINS[i],scale:GOBLIN_SCALE,face:i,outfit:goblinOutfit(i)})));
for(let i=0;i<goblins.length;i++){const actor=goblins[i];actor.root.position.x=(i-1)*.85;actor.root.rotation.y=i===0?.3:i===2?-.4:0;goblinGroup.add(actor.root);}
let kind='rabbits',time=0;
function show(next){kind=next;rabbitGroup.visible=kind==='rabbits';goblinGroup.visible=!rabbitGroup.visible;controls.target.set(0,kind==='rabbits'?.27:.7,0);camera.position.set(kind==='rabbits'?.95:1.25,kind==='rabbits'?1.22:1.5,kind==='rabbits'?3.6:4.8);controls.update();
  document.querySelector('#title').textContent=kind==='rabbits'?'Meadow rabbits':'Briar goblins';document.querySelector('#description').textContent=kind==='rabbits'?'Four coats. Articulated ears, paws and haunches, with a hop cycle and quiet grazing.':'The human rig at 69% scale, with a larger head, pointed ears and a long pointed nose. These use the same registered clothing and animation system as the player.';
  for(const id of ['rabbits','goblins'])document.querySelector('#'+id).classList.toggle('active',id===kind);document.querySelector('#clothing').parentElement.style.display=kind==='rabbits'?'none':'flex';
}
for(const id of ['rabbits','goblins'])document.querySelector('#'+id).onclick=()=>show(id);
// Reapplying the registered outfit restores both garment visibility and its skin coverage mask.
document.querySelector('#clothing').onchange=e=>goblins.forEach((actor,i)=>actor.wardrobe.apply(e.target.checked?goblinOutfit(i):[]));
function frame(dt){time+=dt;const motion=document.querySelector('#motion').value,speed=motion==='walk'?.68:motion==='run'?2.6:0;
  for(let i=0;i<rabbits.length;i++)rabbits[i].update(dt,{speed,grazing:!speed&&i%2===0,alert:i%2===1});
  for(const actor of goblins)actor.update(dt,{speed:motion==='walk'?1.4:motion==='run'?3.9:0,armed:motion==='attack',action:motion==='attack'?{kind:'sword',style:'cut',side:'R',combo:Math.floor(time/.9)%2,progress:(time%.9)/.9}:null});
  controls.update();renderer.render(scene,camera);
}
function resize(){renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();}
window.addEventListener('resize',resize);resize();show('rabbits');
const clock=new THREE.Clock();renderer.setAnimationLoop(()=>frame(Math.min(clock.getDelta(),.05)));
window.creaturePreview={ready:true,renderer,scene,camera,controls,rabbits,goblins,show,frame};
