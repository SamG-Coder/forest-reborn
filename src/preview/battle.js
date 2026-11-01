import {ArrowVolley} from '../effects/arrows.js';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {BattleSimulation} from '../world/battle-simulation.js';
import {createMaleAvatar} from '../avatar/model.js';
import {createGearRegistry} from '../gear/catalog.js';
import {loadGearMaterials} from '../gear/materials.js';
import {LayeredEquipment} from '../gear/equipment.js';
import {createNPCInstances} from '../graphics/npc-instances.js';
import {BloodEffects} from '../effects/blood.js';
import {DamageNumbers} from '../ui/damage-numbers.js';
import {loadWorldMaterials} from '../world/materials.js';
import {itemImage} from '../ui/panel-components.js';
import {itemDefinition} from '../progression/items.js';
import {gridSurfaceHeight} from '../graphics/height-surface.js';
import {recordHitImpact} from '../game/hit-impact.js';
import {BattleOverlays} from '../ui/battle-overlays.js';
import '../ui/battle.css';

const $=s=>document.querySelector(s),canvas=$('canvas'),renderer=new THREE.WebGLRenderer({canvas,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
const perSide=[500,1000,5000].includes(Number(new URLSearchParams(location.search).get('army')))?Number(new URLSearchParams(location.search).get('army')):500;
$('#army-size').value=String(perSide);$('#army-size').onchange=e=>{location.search='?army='+e.target.value;};
for(const el of document.querySelectorAll('#army-score small'))el.textContent=Math.ceil(perSide/50)+' companies';
const scene=new THREE.Scene();scene.background=new THREE.Color('#c6d8d8');scene.fog=new THREE.Fog('#c6d8d8',160,330);
scene.add(new THREE.HemisphereLight('#f2ecd8','#607857',1.5));const sun=new THREE.DirectionalLight('#fff3d9',2.1);sun.position.set(-20,60,30);scene.add(sun);
if(perSide>1000)scene.fog=new THREE.Fog('#c6d8d8',600,1400);
const environment=new RoomEnvironment(),pmrem=new THREE.PMREMGenerator(renderer);scene.environment=pmrem.fromScene(environment,.04).texture;scene.environmentIntensity=.5;pmrem.dispose();environment.dispose();
const camera=new THREE.PerspectiveCamera(45,1,.08,450);camera.position.set(20,68,101);
const controls=new OrbitControls(camera,canvas);controls.target.set(0,0,0);controls.maxDistance=210;controls.minDistance=2;controls.maxPolarAngle=Math.PI*.495;controls.update();
if(perSide>1000){camera.position.set(220,350,520);camera.far=1800;camera.updateProjectionMatrix();controls.maxDistance=1000;controls.update();}
const registry=createGearRegistry(),[template,materials,worldMaterials]=await Promise.all([createMaleAvatar(),loadGearMaterials(),loadWorldMaterials()]);
const wardrobe=new LayeredEquipment(template,registry,materials);template.gearTemplates=wardrobe.templates;template.baseIndices=wardrobe.bodyCoverage.original;
const height=(x,z)=>Math.sin(x*.04)*Math.cos(z*.03)*.5;
const groundGeometry=new THREE.PlaneGeometry(1800,1800,384,384);groundGeometry.rotateX(-Math.PI/2);const gp=groundGeometry.attributes.position,uv=groundGeometry.attributes.uv;
for(let i=0;i<gp.count;i++){gp.setY(i,height(gp.getX(i),gp.getZ(i))-.02);uv.setXY(i,gp.getX(i)/7,gp.getZ(i)/7);}groundGeometry.computeVertexNormals();groundGeometry.setAttribute('roadWeight',new THREE.Float32BufferAttribute(new Float32Array(gp.count),1));
const floor=new THREE.Mesh(groundGeometry,worldMaterials.ground);scene.add(floor);const grid=new THREE.GridHelper(180,45,'#6d826c','#6d826c');grid.position.y=.55;grid.visible=false;scene.add(grid);
let simulation=new BattleSimulation(perSide*2,{registry}),playing=true,speed=1,selected=null;
const surfaceHeight=gridSurfaceHeight(height,{step:600/128,originX:-300,originZ:-300,offset:-.02});
const blood=new BloodEffects(scene,surfaceHeight,{surfaceStep:600/128,characters:perSide*2}),observer=controls.target,damage=new DamageNumbers($('#battle-damage'),camera,observer,{maxDistance:Infinity});
for(const a of simulation.actors){a.position=new THREE.Vector3(a.x,height(a.x,a.z),a.z);blood.register(a);}
const crowd=await createNPCInstances({scene,entities:simulation.actors,profiles:simulation.profiles,template,registry,materials,height,blood,onProgress:(n,total)=>$('#loading').textContent=`Preparing RPG equipment… ${n}/${total}`});
const arrows=new ArrowVolley(scene);
const overlays=new BattleOverlays({canvas,camera,scene,entities:simulation.actors,companies:simulation.companies,height});
let cardId=null;
const report={samples:[],frames:[],errors:[]};let lastUI=-1;
function hit(target,amount,attacker){
  target.position.set(target.x,height(target.x,target.z),target.z);if(attacker)attacker.position.set(attacker.x,height(attacker.x,attacker.z),attacker.z);
  recordHitImpact(target,attacker,amount);
  const options=overlays.damageOptions(target);
  if($('#numbers').checked&&options)damage.show(target,amount,'world',options);
  blood.hit(target,attacker,amount,controls.target,crowd.posePoint(target));
}
function renderUI(){
  const s=simulation.stats(),r=crowd.stats(),sorted=report.samples.slice(-300).sort((a,b)=>a-b);
  $('#blue-count').textContent=s.alive[0];$('#red-count').textContent=s.alive[1];
  $('#stats').textContent=`${s.arrowsFired} arrows · ${s.charges} charges\n${s.hits.toLocaleString()} hits · ${s.blocks} blocks · ${s.defeats} fallen\n${s.routing} companies withdrawing · ${s.time.toFixed(1)}s\nLOD: ${r.lodCounts.join(' / ')} (full / mid / far / distant)\n${r.ragdolls} articulated bodies · ${renderer.info.render.calls} draws\n${(r.triangles/1e6).toFixed(2)}M triangles · CPU p95 ${(sorted[Math.floor(sorted.length*.95)]??0).toFixed(2)}ms${s.winner?'\n'+(s.winner<0?'Highmere':'Ash Company')+' holds the field.':''}`;
  const panel=$('#soldier-card');
  if(selected){
    const a=selected;
    if(cardId!==a.id){
      cardId=a.id;panel.replaceChildren();const title=document.createElement('h3');title.textContent=a.name;panel.append(title);
      const stats=document.createElement('p');stats.className='selected-stats';panel.append(stats);
      for(const id of [a.weapon,...a.equipped]){const row=document.createElement('div'),item=itemDefinition(id,registry);row.className='battle-gear';itemImage(row,item);row.append(document.createTextNode(item.name));panel.append(row);}
      const clear=document.createElement('button');clear.textContent='Clear selection';clear.onclick=()=>{selected=null;cardId=null;overlays.select(null);panel.replaceChildren();};panel.append(clear);
    }
    panel.querySelector('.selected-stats').textContent=`Level ${a.level} · ${Math.ceil(a.hp)}/${a.maxHp} HP\n${a.stats.armor} armor · ${a.damage} damage · ${a.stats.interval}s attack\n${a.factionId} · ${simulation.companies[a.squad].order}`;
  }
}
function frame(dt){
  overlays.update();const before=performance.now();if(playing)simulation.update(dt*speed,hit);const ms=performance.now()-before;report.samples.push(ms);if(report.samples.length>1800)report.samples.shift();
  for(const a of simulation.actors)a.position.set(a.x,height(a.x,a.z),a.z);
  simulation.events.length=0;crowd.update(camera,simulation.time,playing?dt*speed:0);arrows.update(simulation.projectiles,simulation.time);blood.update(playing?dt*speed:0,controls.target);damage.update(playing?dt*speed:0,innerWidth,innerHeight);renderer.render(scene,camera);
  if(performance.now()-lastUI>120){lastUI=performance.now();renderUI();}return ms;
}
function resize(){renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();}addEventListener('resize',resize);resize();
$('#pause').onclick=event=>{playing=!playing;event.target.textContent=playing?'Pause':'Resume';};
$('#restart').onclick=()=>{const fresh=new BattleSimulation(perSide*2,{registry});simulation.actors.forEach((a,i)=>{const position=a.position,woundSlot=a.woundSlot;for(const key of simulation.savedFields)delete a[key];Object.assign(a,fresh.actors[i]);a.position=position;a.woundSlot=woundSlot;blood.clear(a);crowd.ragdolls.remove(a.id);});simulation.companies=fresh.companies;overlays.companies=simulation.companies;simulation.steps=0;simulation.accumulator=0;simulation.perceptionChecks=0;simulation.winner=null;simulation.events.length=0;simulation.rebuild();simulation.time=0;simulation.projectiles=[];simulation.arrowsFired=0;simulation.charges=0;simulation.hits=0;simulation.blocks=0;simulation.defeats=0;simulation.seed=fresh.seed;playing=true;$('#pause').textContent='Pause';blood.reset();damage.clear();crowd.states.clear();};
$('#speed').onchange=event=>speed=Number(event.target.value);$('#grid').onchange=event=>grid.visible=event.target.checked;
let pointerDown=null;canvas.addEventListener('pointerdown',e=>pointerDown=[e.clientX,e.clientY]);canvas.addEventListener('pointerup',e=>{if(!pointerDown||Math.hypot(e.clientX-pointerDown[0],e.clientY-pointerDown[1])>5)return;const picked=overlays.pick(e.clientX,e.clientY);if(picked){selected=picked;overlays.select(selected);renderUI();}});
let previous=performance.now();renderer.setAnimationLoop(now=>{const elapsed=(now-previous)/1000,dt=Math.min(.1,elapsed);previous=now;report.frames.push(elapsed*1000);if(report.frames.length>600)report.frames.shift();frame(dt);});
$('#loading').remove();window.battleDemo={ready:true,frame,report,renderer,camera,controls,crowd,blood,damage,hit,overlays,get simulation(){return simulation;},setPlaying(value){playing=value;},inspect(id){selected=simulation.actors[id];overlays.select(selected);renderUI();}};
