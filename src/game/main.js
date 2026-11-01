import {PEDESTRIAN_SPEED} from './locomotion-speed.js';
import {GameAudio} from '../audio/mixer.js';
import {WorldSounds} from '../audio/world-sounds.js';
import {createAudioSettings} from '../ui/audio-settings.js';
import {DayNight} from '../world/day-night.js';
import {createTownLife} from '../world/town-life.js';
import {createChat} from '../ui/chat.js';
import {createPlayerRemains} from '../npc/player-remains.js';
import {installGameWindows,closeTopGameWindow} from '../ui/game-window.js';
import {SocialContracts} from '../npc/social-contracts.js';
import {ProjectileEffects} from '../effects/arrows.js';
import {selectedArrow,spendArrow} from './archery.js';
import {updateHostileCombat} from '../npc/hostile-combat.js';
import * as THREE from 'three';
import { createMaleAvatar } from '../avatar/model.js';
import { FACE_STYLES,BODY_STYLES } from '../avatar/catalog.js';
import { equipPracticeSword } from './equipment.js';
import { CharacterAnimator } from './animation.js';
import { ACTIONS,CombatController,wrapAngle } from './combat.js';
import {isWeapon,weaponAction,weaponDefinition} from './weapon-catalog.js';
import {addStatus,tickStatuses} from './status-effects.js';
import {recordHitImpact} from './hit-impact.js';
import {createLootPanel} from '../ui/loot-panel.js';
import {createFactionPanel} from '../ui/faction-panel.js';
import {createFactionLandmarks} from '../factions/landmarks.js';
import {TargetIndicator,TargetCycle,closestTarget,targetDistance,inAttackRange,TARGET_RANGE} from './targeting.js';
import { updateJump } from './jump.js';
import { WeaponTrail } from './weapon-trail.js';
import { GameInput } from './input.js';
import {consumeMouseCamera,updateMouseHeading,followMovementHeading,movementDirection} from './mouse-camera.js';
import {FollowCamera,loadCameraSettings} from './follow-camera.js';
import {createCameraSettings} from '../ui/camera-settings.js';
import {createSocietyPanel} from '../ui/society-panel.js';
import {createMMOHud} from './mmo-hud.js';
import { createWorld } from './world.js';
import { createGearRegistry } from '../gear/catalog.js';
import { loadGearMaterials } from '../gear/materials.js';
import { LayeredEquipment } from '../gear/equipment.js';
import { createPopulation } from '../npc/population.js';
import { AdventurerSimulation } from '../npc/simulation.js';
import {recordPlayerKill} from '../npc/society.js';
import {facePoint} from '../npc/motion.js';
import { PlayerProgress, STARTING_EQUIPMENT, levelThreshold } from '../progression/save.js';
import { createWorldUI } from '../progression/ui.js';
import { clampToWorld, inTown } from '../world/terrain.js';
import { createHairSystem, HAIR_STYLES } from '../hair/system.js';
import {createPlayerPanels} from '../ui/player-panels.js';
import {installTooltips} from '../ui/tooltip.js';
import {decorateHotbar} from '../ui/hotbar-icons.js';
import {DamageNumbers} from '../ui/damage-numbers.js';
import {characterStats} from '../progression/character-stats.js';
import {formatMoney} from '../progression/currency.js';
import {SkillAction} from './skill-action.js';
import {JobAnimation} from '../npc/job-animation.js';
import {GATHERING} from '../progression/skills.js';
import {RECIPES,craftedBag,craftItem} from '../progression/recipes.js';
import {session,updateSession} from '../session/session.js';
import {installCreator} from '../creator/creator-ui.js';
import {createStudio} from '../creator/studio.js';
import {ReincarnationOpening} from '../cinematic/opening.js';
import {WAKE_TIME} from '../cinematic/opening-script.js';
import {matchingHair} from '../hair/catalog.js';
import {HairThumbnails} from '../creator/hair-thumbnails.js';
import {createGameMenu} from '../session/game-menu.js';
import {sharedVoices} from '../audio/voices.js';
import {GuardSpeech} from '../audio/guard-speech.js';
import {DialogueDirector} from '../audio/dialogue.js';
import {MountController} from '../mounts/controller.js';
import {mountedAttack} from '../mounts/combat.js';
import {MOUNT_SPEED} from '../mounts/catalog.js';
import {createObjectiveHUD} from '../ui/objective-hud.js';
import {createExpansion} from '../world/expansion.js';
import {inHighmere} from '../world/region-layout.js';
import './style.css';
import '../world/style.css';
import './mmo-hud.css';
import '../ui/quest-markers.css';
import '../ui/panel-theme.css';
import '../ui/objective-hud.css';
import '../ui/inventory-windows.css';

const $=selector=>document.querySelector(selector),canvas=$('#game');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;
const scene=new THREE.Scene();scene.background=new THREE.Color('#c9dfe2');scene.fog=new THREE.Fog('#c9dfe2',500,1700);
const ambient=new THREE.HemisphereLight('#e5f0e1','#6b8661',1.65);scene.add(ambient);
const sun=new THREE.DirectionalLight('#fff0cb',2.1);sun.position.set(-10,18,9);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-14,right:14,top:14,bottom:-14,near:.5,far:45});sun.shadow.normalBias=.035;sun.shadow.bias=-.00015;scene.add(sun);
const camera=new THREE.PerspectiveCamera(43,innerWidth/innerHeight,.05,1950);
const [world,avatar]=await Promise.all([createWorld(scene),createMaleAvatar()]);scene.add(avatar.root);
avatar.root.traverse(node=>{if(node.isMesh){node.castShadow=true;node.receiveShadow=true;}});
const followCamera=new FollowCamera(camera,world.height,loadCameraSettings(localStorage));
const equipment=equipPracticeSword(avatar);
const gearMaterials=await loadGearMaterials(),registry=createGearRegistry();
const wardrobe=new LayeredEquipment(avatar,registry,gearMaterials),progress=new PlayerProgress(session.storage,registry);
const dayNight=new DayNight({scene,sun,ambient,save:progress.data.realm??={version:1,companions:[],discovered:[]}});world.dayNight=dayNight;
dayNight.register(world.town.interiorLights);
await dayNight.loadSky(camera);
avatar.gearTemplates=wardrobe.templates;avatar.baseIndices=wardrobe.bodyCoverage.original;
progress.data.equipped=progress.data.equipped.filter(id=>{try{return Boolean(registry.get(id));}catch{return false;}});
if(!progress.data.equipped.length)progress.data.equipped=[...STARTING_EQUIPMENT];
const hair=await createHairSystem(avatar,wardrobe.templates.helmet);
const simulation=new AdventurerSimulation(session.storage);simulation.factions.bind(progress);
const factionLandmarks=createFactionLandmarks(scene,progress);
const population=await createPopulation(scene,avatar,registry,gearMaterials,simulation,world.buildings,world.resources);world.population=population;world.targets.push(...population.targets);await population.catchUp();
population.contracts=new SocialContracts(progress,population);simulation.contracts=population.contracts;
let appliedOutfit=null;
const targeting=new TargetIndicator(scene,camera,canvas,world.targets,world.height);
const targetCycle=new TargetCycle();
const friendlyTargets=()=>population.residents.filter(p=>!p.dormant&&p.data?.journey?.phase!=='waiting').map(person=>person.target);
const attackableTargets=()=>[...world.targets.filter(t=>population.living.canPlayerAttack(t)),...population.living.autoTargets()];
const stationTargets=()=>world.workstations.stations.map(station=>({station,id:'station:'+station.id,root:station.root,position:station.root.position,hp:1,pickHeight:1.8,pickRadius:.7,kind:'workstation'}));
const resourceTargets=()=>world.resources.available().filter(node=>Math.hypot(node.x-player.position.x,node.z-player.position.z)<35).map(node=>({node,position:(node.root??world.resources.roots.get(node.id)).position,root:node.root??world.resources.roots.get(node.id),hp:100,pickHeight:node.tree?4:.7,pickRadius:node.tree?node.radius+.15:undefined,kind:'resource'}));
const animator=new CharacterAnimator(avatar),combat=new CombatController(),input=new GameInput(canvas);
const skillAction=new SkillAction(),jobAnimation=new JobAnimation(avatar);
let tradingTime=0;
const player={position:new THREE.Vector3(0,0,3),velocity:new THREE.Vector3(),yaw:Math.PI,speed:0,grounded:true,verticalSpeed:0,level:1,xp:0,dodge:0,death:0};
const state={mode:'create',modern:true,editing:false,paused:false,lock:null,autoAttack:false,nextAttack:0,lab:null,hits:0,blocks:0,kills:0,mute:false,cameraYaw:0,cameraPitch:.32,cameraDistance:4.5,closeup:false,turn:false,hitstop:0,shake:0};
const appearance={name:'Ren',bodyType:'male',face:0,eyes:'#548cab',skin:'#efc4a3',body:0,hair:'swept',hairColor:'#3d3030',shirtColor:'#ffffff',height:1,voice:'Jasper'};
try{const saved=JSON.parse(session.storage.getItem('forest-reborn-character-v1'));if(saved&&typeof saved==='object'){if(!saved.outfitVersion)saved.shirtColor='#ffffff';Object.keys(appearance).forEach(key=>{if(key in saved)appearance[key]=saved[key];});}}catch{}
appearance.outfitVersion=2;
appearance.height=THREE.MathUtils.clamp(Number(appearance.height)||1,.91,1.08);
appearance.face=THREE.MathUtils.clamp(Number(appearance.face)||0,0,4);appearance.body=Number(appearance.body)===1?1:0;
for(const key of ['eyes','skin','hairColor','shirtColor'])if(!/^#[0-9a-f]{6}$/i.test(appearance[key]))appearance[key]='#548cab';
if(!['male','female'].includes(appearance.bodyType))appearance.bodyType='male';
appearance.name=String(appearance.name??'Ren').slice(0,20);
population.living.bindPlayer({player,combat,progress,isActive:()=>state.mode==='play'&&!state.paused,name:appearance.name});
Object.assign(population.living.player.target,{root:avatar.root,controller:{root:avatar.root,avatar},materials:[avatar.materials.skin]});
combat.canDamage=target=>population.living.canPlayerAttack(target)&&population.navigation.segmentClear(player.position,target.position);
combat.hasArrow=()=>Boolean(selectedArrow(progress.data));combat.consumeArrow=()=>{const arrow=spendArrow(progress.data);progress.save();return arrow;};
const projectiles=new ProjectileEffects(scene);
if(!Object.hasOwn(HAIR_STYLES,appearance.hair))appearance.hair='swept';
let audio=null,messageTimer=0,elapsed=0;
const gameAudio=new GameAudio(()=>audio,localStorage),worldSounds=new WorldSounds(gameAudio,population);
const voices=sharedVoices({getContext:()=>audio,mixer:gameAudio,onStatus:status=>{document.documentElement.dataset.voiceStatus=status;}});
const guardSpeech=new GuardSpeech({voices,player,living:population.living});
const dialogue=new DialogueDirector(progress,population);
const mounts=new MountController({scene,player,progress,avatar,world,navigation:population.navigation,message,
  canMount:()=>state.mode==='play'&&!state.paused&&!combat.action&&!state.autoAttack&&!skillAction.current&&combat.hp>0&&(progress.data.pvp?.combatUntil??0)<Date.now(),
  onChange:mounted=>{selectEnemy(null);input.clear();followCamera.reset();if(mounted)state.cameraDistance=Math.max(5.5,state.cameraDistance);},
});
const playerVoice=()=>({id:'player',gender:appearance.bodyType,voice:appearance.voice});
const expansion=createExpansion({scene,world,template:avatar,registry,gearMaterials,population,camera,renderer,progress,player,voices,message,dialogue,
  getAudio:()=>state.mute?null:audio,onCinematicStart:()=>{input.enabled=false;input.clear();$('#hud').hidden=true;},onCinematicEnd:()=>{input.enabled=true;input.clear();$('#hud').hidden=false;followCamera.reset();},
  canTravel:()=>state.mode==='play'&&!combat.action&&!state.autoAttack&&combat.hp>0&&player.grounded,
  onTravel:point=>{mounts.reset();selectEnemy(null);input.clear();player.position.fromArray(point);player.position.y=world.height(player.position.x,player.position.z);player.velocity.set(0,0,0);player.speed=0;player.yaw=Math.PI;followCamera.reset();progress.data.position=player.position.toArray();},
});world.expansion=expansion;
const townLife=await createTownLife({scene,world,population,progress,template:avatar,registry,materials:gearMaterials,player,message});world.townLife=townLife;
function sound(kind,position=player.position){
  const effect={blocked:'metal','target-blocked':'metal',hurt:'hit'}[kind]??kind;
  gameAudio.play(effect,position,{priority:true});
}
function message(text,duration=3){$('#message').textContent=text;$('#message').classList.add('show');messageTimer=duration;}
function applyAppearance(){
  appearance.hair=matchingHair(appearance.hair,appearance.bodyType);
  avatar.bodySystem.setType(appearance.bodyType);
  avatar.root.scale.setScalar(appearance.height);
  document.querySelector('.creation-caption span').textContent=appearance.bodyType.toUpperCase()+' / '+Math.round(179*appearance.height)+' CM';
  avatar.materials.setFace(appearance.face);avatar.materials.setBody(appearance.body);avatar.materials.setEye(appearance.eyes);avatar.materials.setSkin(appearance.skin);
  hair.setStyle(appearance.hair);hair.setColor(appearance.hairColor);
  const ids=state.modern?['modern.tshirt','modern.jeans','modern.sneakers']:progress.data.equipped;
  const next=appearance.bodyType+'|'+ids.join('|');if(appliedOutfit!==next){wardrobe.apply(ids);equipment.setMetal('iron');appliedOutfit=next;}
  if(state.modern)for(const mesh of wardrobe.entries.get('clothes').meshes)mesh.material.color.set(appearance.shirtColor);
  hair.setHeadwear(wardrobe.entries.get('head')?.definition);
  avatar.bodySystem.updateCoverage(wardrobe.entries.has('clothes')||wardrobe.entries.has('body'));
  combat.stats=characterStats(progress.data,registry);
}
const studio=createStudio();
const hairThumbnails=new HairThumbnails(renderer,studio.scene,avatar);
const creatorUI=installCreator({appearance,onChange:()=>{applyAppearance();creatorUI.sync();},onVoicePreview:()=>{unlockAudio();return voices.speak(playerVoice(),'A late shift. A walk home. Nothing out of the ordinary.',{channel:'preview',maxDelay:60000});},onBack:async()=>{saveAppearance();await saveSession();location.reload();}});
for(const [i,face]of FACE_STYLES.entries())$('#face').add(new Option(face.name,i));
for(const [i,body]of BODY_STYLES.entries())$('#skin-detail').add(new Option(body.name,i));
for(const [id,label] of Object.entries(HAIR_STYLES))$('#hair').add(new Option(label,id));
const fields={'character-name':'name','body-type':'bodyType',face:'face',eyes:'eyes',skin:'skin','skin-detail':'body',hair:'hair','hair-color':'hairColor','shirt-color':'shirtColor','character-height':'height'};
for(const [id,key]of Object.entries(fields)){const control=$(`#${id}`);control.value=appearance[key];control.addEventListener('input',()=>{appearance[key]=['face','body','height'].includes(key)?Number(control.value):control.value;if(key!=='name')applyAppearance();creatorUI.sync();});}
applyAppearance();
creatorUI.sync();studio.scene.add(avatar.root);
$('#rotate-character').onclick=()=>state.turn=!state.turn;
$('#creation-closeup').onclick=()=>state.closeup=!state.closeup;
$('#reset-view').onclick=()=>{creatorUI.controls.angle=-.15;creatorUI.controls.zoom=1;state.closeup=false;state.turn=false;};
let creatorDrag=false;
canvas.addEventListener('pointerdown',e=>{if(state.mode==='create'){creatorDrag=true;canvas.setPointerCapture(e.pointerId);}});
canvas.addEventListener('pointermove',e=>{if(creatorDrag&&state.mode==='create'){creatorUI.controls.angle+=e.movementX*.009;state.turn=false;}});
canvas.addEventListener('pointerup',()=>creatorDrag=false);
canvas.addEventListener('wheel',e=>{if(state.mode==='create'){creatorUI.controls.zoom=THREE.MathUtils.clamp(creatorUI.controls.zoom+e.deltaY*.001,.7,1.5);e.preventDefault();}},{passive:false});
function saveAppearance(){
  appearance.name=appearance.name.trim()||'Ren';
  session.storage.setItem('forest-reborn-character-v1',JSON.stringify(appearance));
  updateSession({characterName:appearance.name,...(session.entry.name==='New life'?{name:appearance.name}:{}),level:progress.data.level});
}
function unlockAudio(){audio??=new (window.AudioContext||window.webkitAudioContext)();gameAudio.ensure();audio.resume();voices.warm();}
// Continuing a save bypasses the creator's Begin button, so unlock on play input too.
canvas.addEventListener('pointerdown',unlockAudio,{once:true});
window.addEventListener('keydown',unlockAudio,{once:true});
function enter(){
  saveAppearance();unlockAudio();voices.stop('preview');
  if(state.editing||session.entry.stage==='world'){state.editing=false;enterWorld();return;}
  const portrait=document.createElement('canvas');portrait.width=144;portrait.height=180;
  portrait.getContext('2d').drawImage(canvas,canvas.width*.43,canvas.height*.12,canvas.width*.35,canvas.height*.73,0,0,144,180);
  updateSession({stage:'opening',portrait:portrait.toDataURL('image/jpeg',.68)});progress.save();
  state.mode='opening';state.paused=false;input.enabled=false;input.clear();$('#creator').hidden=true;$('#hud').hidden=true;equipment.sword.visible=false;opening.start(audio);
}
function enterWorld(){followCamera.reset();state.mode='play';state.modern=false;state.paused=false;input.enabled=true;input.clear();scene.add(avatar.root);applyAppearance();
  const saved=progress.data.position;if(Array.isArray(saved)&&saved.length===3&&saved.every(Number.isFinite))player.position.fromArray(saved);else player.position.set(0,0,17);
  clampToWorld(player.position);player.position.y=world.height(player.position.x,player.position.z);player.velocity.set(0,0,0);player.yaw=Math.PI;player.grounded=true;player.verticalSpeed=0;state.cameraYaw=0;combat.reset();$('#creator').hidden=true;$('#hud').hidden=false;$('#player-name').textContent=appearance.name.trim()||'Ren';
  saveAppearance();
  message(simulation.offline.seconds>120?`While you were away, the adventurers made ${simulation.offline.kills} kills. Your friends are still around.`:'Mosswake. A bell, warm bread, and no idea how you got here. Find Tomas at the tavern.',7);
}
const opening=await ReincarnationOpening.create({avatar,animator,wardrobe,camera,renderer,world,scene,voices,playerVoice,name:()=>appearance.name,onWake:()=>{state.modern=false;applyAppearance();},onComplete:position=>{
  progress.data.position=position.toArray();progress.data.prologue={completed:true,chapter:'A different morning'};progress.save();updateSession({stage:'world'});enterWorld();saveSession();message('No phone. No keys. Find Tomas at the Wayward Oak, just off the square.',8);
}});
$('#enter').onclick=enter;
function editAppearance(){saveSession();mounts.reset();state.mode='create';state.modern=false;state.editing=true;input.enabled=false;input.clear();selectEnemy(null);skillAction.cancel();state.lab=null;equipment.sword.visible=false;playerPanels.close();studio.scene.add(avatar.root);$('#enter').innerHTML='Save appearance <span>→</span>';$('#creator').hidden=false;$('#hud').hidden=true;}
$('#edit-character').onclick=()=>playerPanels.toggle('character');
$('#mute').onclick=()=>{state.mute=!state.mute;voices.setMuted(state.mute);gameAudio.setMuted(state.mute);$('#mute').textContent=`Sound: ${state.mute?'off':'on'}`;};
function weapon(name){
  if(isWeapon(name)&&!progress.data.weapons.includes(name)){message('Earn a sword first. Tomas has work at the tavern.',3);return false;}
  if(name!==progress.data.weapon){
    const success=name==='unarmed'?progress.unequip('weapon'):progress.equipItem(progress.data.bag.findIndex(s=>s?.id===name));
    if(!success){message(progress.lastError||'That weapon is not in your bag.',3);return false;}
  }
  if(combat.weapon!==name){combat.action=null;combat.queued=null;}
  combat.weapon=name;progress.data.weapon=name;progress.save();equipment.sword.visible=isWeapon(name);if(isWeapon(name))equipment.setWeapon(name);$('#weapon-label').textContent=weaponDefinition(name)?.name??'Unarmed';
  return true;
}
weapon(progress.data.weapon);
function selectEnemy(target){state.friendly=null;state.lock=target;state.autoAttack=false;combat.setTarget(target);}
function requestAttack(kind,side=null,style='cut',power=0){
  if(weaponAction(combat.weapon).ranged&&!selectedArrow(progress.data)){state.autoAttack=false;message('You need arrows. Buy them from Orin or fletch them at the carpenter’s bench.',4);return false;}
  if(mounts.mounted&&kind!=='sword'){message('Equip a weapon for mounted combat.',2);return false;}
  if(state.lock?.person&&!population.living.canPlayerAttack(state.lock))return false;
  if(kind==='sword'&&!isWeapon(combat.weapon))return false;
  if(!state.lab&&!inAttackRange(player.position,state.lock,mountedAttack(kind==='sword'?weaponAction(combat.weapon):ACTIONS[kind],{mounted:mounts.mounted}).reach))return false;
  if(!combat.action&&kind==='punch'&&combat.weapon!=='unarmed')weapon('unarmed');
  combat.stats=characterStats(progress.data,registry);
  combat.mounted=mounts.mounted;const started=combat.request(kind,side,player.speed,style,power);
  if(started){skillAction.cancel();if(state.lock?.person)population.living.playerAttacks(state.lock);}
  if(started)state.nextAttack=combat.time+(kind==='sword'?weaponAction(combat.weapon):ACTIONS[kind]).interval;return started;
}
function toggleAttack(){
  if(!state.lock||state.lock.hp<=0)selectEnemy(closestTarget(player.position,attackableTargets()));
  if(!state.lock){message('No living enemies nearby.',2);return;}
  state.autoAttack=!state.autoAttack;state.nextAttack=Math.min(state.nextAttack,combat.time);
}
$('#attack').onclick=toggleAttack;
$('#moves').hidden=!new URLSearchParams(location.search).has('debug');
$('#moves').onclick=()=>{$('#move-panel').hidden=!$('#move-panel').hidden;state.lab=$('#move-panel').hidden?null:'idle';input.clear();};
for(const name of ['idle','chill','walk','run','swing','thrust','combo','left punch','right punch','block']){const button=document.createElement('button');button.textContent=name;button.onclick=()=>{state.lab=name;if(name==='chill')animator.idleTime=10;if(name==='swing'||name==='combo'||name==='thrust'){weapon('sword');combat.request('sword',null,0,name==='thrust'?'thrust':'cut');}if(name.includes('punch'))requestAttack('punch',name.startsWith('left')?'L':'R');};$('#move-buttons').append(button);}
$('#exit-moves').onclick=()=>{state.lab=null;$('#move-panel').hidden=true;$('#show-rig').checked=false;rigDebug.visible=false;gripAxes.visible=false;};
const rigDebug=new THREE.Group();scene.add(rigDebug);rigDebug.visible=false;rigDebug.add(avatar.helper);avatar.helper.visible=true;
const gripAxes=new THREE.AxesHelper(.12);equipment.sword.userData.socket.add(gripAxes);gripAxes.visible=false;
$('#show-rig').onchange=()=>{rigDebug.visible=$('#show-rig').checked;gripAxes.visible=rigDebug.visible;};
for(const [label,yaw]of [['Front',Math.PI],['Side',Math.PI/2],['Back',0]]){const button=document.createElement('button');button.textContent=label;button.onclick=()=>{state.cameraYaw=player.yaw+yaw;state.cameraDistance=2.7;state.cameraPitch=.12;};$('#preview-views').append(button);}
window.addEventListener('keydown',e=>{
  if(state.mode!=='play'||/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)||e.repeat)return;
  if(e.code==='Escape'){if(closeTopGameWindow($('#hud')))return;if(skillAction.current){skillAction.cancel();return;}if(state.lock||state.friendly){selectEnemy(null);return;}gameMenu.open();return;}
  if(e.code==='Tab'){e.preventDefault();selectEnemy(targetCycle.next(state.lock,player.position,player.yaw,attackableTargets(),e.shiftKey));}
  if(e.code==='KeyH'&&!state.paused){e.preventDefault();mounts.toggle();}
  if(e.code==='KeyR'&&!mounts.mounted&&!combat.action&&combat.stamina>18){player.dodge=.32;combat.stamina-=18;}
});
const effects=[],damageNumbers=new DamageNumbers($('#damage-numbers'),camera,player.position);
function burst(position,color,count=9){for(let i=0;i<count;i++){const m=new THREE.Mesh(new THREE.IcosahedronGeometry(.025,0),new THREE.MeshBasicMaterial({color}));m.position.copy(position);scene.add(m);effects.push({mesh:m,velocity:new THREE.Vector3((Math.random()-.5)*2,Math.random()*2,(Math.random()-.5)*2),life:.38,max:.38});}}
const trail=new WeaponTrail(scene,equipment.sword.userData.markers);
for(const target of world.targets){const tag=document.createElement('div');tag.innerHTML=`${target.name}${target.level?' · Lv '+target.level:''}<div class="enemy-bar"><i></i></div>`;$('#target-tags').append(tag);target.tag=tag;}
function updateTargets(dt){
  for(const target of world.targets){
    if(target.dormant||target.externalSimulation)continue;
    target.flash=Math.max(0,target.flash-dt);target.stagger=Math.max(0,target.stagger-dt);
    for(const material of target.materials)material.emissive.setHex(target.flash>0?0x554433:0x000000);
    if(target.hp<=0)continue;
    tickStatuses(target,elapsed,(damage)=>combat.events.push({type:'hit',periodic:true,target,damage,kind:'sword',dead:target.hp<=0}));
    if(target.hp<=0)continue;
    if(target.wildlife)continue; // Roaming, fleeing and hop poses have one owner.
    if(!state.lab)updateHostileCombat(target,dt,{population,factions:simulation.factions,world});
  }
}
function updatePlayer(dt){
  if(combat.hp<=0){
    if(!player.death){
      mounts.reset();input.clear();selectEnemy(null);skillAction.cancel();
      const remains=createPlayerRemains(avatar,scene,Date.now());remains.lootOverride={coins:0,items:[]};remains.hitDirection=population.living.player.target.hitDirection;
      population.corpses.kill(remains,Date.now(),population.living.player.target.recentAttacker);
      message('You have fallen. The watch will bring you back to town.',6);
    }
    player.death+=dt;player.speed=0;player.velocity.set(0,0,0);avatar.root.visible=false;
    if(player.death>=6){
      const northern=inHighmere(player.position.x,player.position.z,260);combat.reset();player.position.set(northern?850:0,0,northern?-789:17);player.position.y=world.height(player.position.x,player.position.z);player.death=0;avatar.root.visible=true;
      population.blood.clear(population.living.player.target);Object.assign(progress.data.pvp,{enabled:false,wantedUntil:0,combatUntil:0,clearAt:0});followCamera.reset();
    }
    return;
  }
  if(!state.lab)updateMouseHeading(input,player,state,dt);
  if(state.fly){
    const heading=movementDirection(input.movement,player.yaw),speed=input.running?32:12;
    player.velocity.set(heading.x*speed,0,heading.z*speed);player.position.addScaledVector(player.velocity,dt);
    player.position.y+=((input.keys.has('Space')?1:0)-(input.keys.has('ControlLeft')||input.keys.has('ControlRight')?1:0))*speed*dt;
    clampToWorld(player.position);player.position.y=Math.max(world.height(player.position.x,player.position.z)+.3,player.position.y);
    player.grounded=false;player.verticalSpeed=0;player.speed=0;input.jumps=0;return;
  }
  for(const click of input.selections.splice(0)){
    const picked=targeting.pick(click.x,click.y,player.position,[...population.corpses.picks(player.position),...world.targets,...friendlyTargets(),...resourceTargets(),...stationTargets()]);
    selectEnemy(null);
    if(picked?.loot){lootPanel.show(picked.loot);}
    else if(picked?.person&&population.living.canPlayerAttack(picked)){selectEnemy(picked);state.autoAttack=true;}
    else if(picked?.person){state.friendly=picked.person;if(picked.person.type!=='adventurer'&&picked.person.position.distanceTo(player.position)<3)worldUI.talk(picked.person);}
    else if(picked?.station)worldUI.workstation(picked.station);
    else if(picked?.node)startGather(picked.node);
    else if(picked){selectEnemy(picked);state.autoAttack=true;}
  }
  const jumped=input.jumps>0;input.jumps=0;
  if(updateJump(player,dt,jumped&&!state.lab,world.height(player.position.x,player.position.z))){animator.landing=1;animator.landingImpact=THREE.MathUtils.clamp(player.landingSpeed/5,.4,1);}
  const movement=state.lab?{x:0,z:0}:input.movement,heading=movementDirection(movement,player.yaw);const direction=new THREE.Vector3(heading.x,0,heading.z);
  if(direction.lengthSq()>1)direction.normalize();
  let speed=mounts.mounted?(input.running?MOUNT_SPEED.canter:MOUNT_SPEED.walk):(input.running?PEDESTRIAN_SPEED.run:PEDESTRIAN_SPEED.walk);
  if(player.dodge>0){player.dodge-=dt;if(direction.lengthSq()<.01)direction.set(Math.sin(player.yaw),0,Math.cos(player.yaw));speed=6;}
  const targetVelocity=direction.multiplyScalar(speed);player.velocity.lerp(targetVelocity,1-Math.exp(-dt*10));player.speed=player.velocity.length();
  if(state.lock&&(state.lock.hp<=0||targetDistance(player.position,state.lock)>TARGET_RANGE))selectEnemy(null);
  if(state.lock&&!input.steering&&!input.turn&&!movement.x&&!movement.z){const angle=Math.atan2(state.lock.position.x-player.position.x,state.lock.position.z-player.position.z);player.yaw+=wrapAngle(angle-player.yaw)*Math.min(1,dt*12);}
  const previousPosition=player.position.clone();player.position.addScaledVector(player.velocity,dt);
  if(mounts.mounted&&!mounts.canMoveTo(player.position)){player.position.copy(previousPosition);player.velocity.set(0,0,0);}
  for(const c of [...world.colliders,...world.targets.filter(t=>t.hp>0&&t.position.distanceToSquared(player.position)<9).map(t=>({x:t.position.x,z:t.position.z,r:.36}))]){const dx=player.position.x-c.x,dz=player.position.z-c.z,d=Math.hypot(dx,dz),r=c.r+.25;if(d<r){player.position.x=c.x+dx/Math.max(d,.001)*r;player.position.z=c.z+dz/Math.max(d,.001)*r;}}
  for(const c of world.buildings){const x=player.position.x,z=player.position.z,r=.26;if(x>c.minX-r&&x<c.maxX+r&&z>c.minZ-r&&z<c.maxZ+r){const distances=[x-(c.minX-r),c.maxX+r-x,z-(c.minZ-r),c.maxZ+r-z],side=distances.indexOf(Math.min(...distances));if(side===0)player.position.x=c.minX-r;else if(side===1)player.position.x=c.maxX+r;else if(side===2)player.position.z=c.minZ-r;else player.position.z=c.maxZ+r;}}
  clampToWorld(player.position);if(player.grounded)player.position.y=world.height(player.position.x,player.position.z);
  if(mounts.mounted&&dt>0)player.speed=Math.hypot(player.position.x-previousPosition.x,player.position.z-previousPosition.z)/dt;
  combat.mounted=mounts.mounted;if(player.grounded)combat.charge(player,previousPosition,world.targets);
  skillAction.update(dt,player.position,!player.grounded||player.speed>.1||Boolean(combat.action)||state.autoAttack,({node,definition,recipe})=>{
    if(recipe){if(craftItem(progress,recipe))message(`Made ${progress.item(recipe.output).name} · +${recipe.xp} skill XP`,3);else message(progress.lastError,3);return;}
    if(!progress.canAddItem(node.kind,definition.yield??1)){message('Your bag is full.',3);return;}
    const kind=world.resources.harvest(node.id,player.position,Date.now());
    if(kind){progress.addItem(kind,definition.yield??1);progress.recordObjective('gather:'+kind,definition.yield??1);progress.data.coins+=simulation.society.contribute('player','gather',player.position,Date.now());progress.addXP(2);progress.addSkillXP(definition.skill,definition.xp);progress.save();message(`Gathered ${progress.item(kind).name} · +${definition.xp} skill XP`,3);}
  });
  if(skillAction.current){const node=skillAction.current.node;player.yaw=Math.atan2(node.x-player.position.x,node.z-player.position.z);}
  for(const attack of input.attacks.splice(0))if(attack==='attack')toggleAttack();
  if(state.autoAttack&&!state.lab&&!combat.action&&!combat.block&&combat.time>=state.nextAttack){
    requestAttack(isWeapon(combat.weapon)?'sword':'punch');
  }
  if(state.lab==='combo'&&combat.action?.kind==='sword'&&combat.action.combo<2&&combat.action.progress>.2&&!combat.queued)combat.request('sword');
  combat.update(dt,player,state.lab?[]:world.targets);
}
function handleCombatEvents(){
  for(const event of combat.events.splice(0)){
    if(event.type==='arrow'){projectiles.add(event.shot);continue;}
    if(!['miss','swing'].includes(event.type))sound(event.type==='hit'?(event.skill==='archery'?'arrowHit':event.kind==='punch'?'punch':'hit'):event.type,event.target?.position??player.position);
    if(event.type==='miss')message(event.reason,1);
    if(event.type==='hit'){population.contracts.recordHit('player',event.target);simulation.society.recordBountyHit('player',event.target);if(event.target.zoneId)expansion.director.contribute('damage',event.damage,event.target.zoneId);state.hits++;state.hitstop=event.power?.075:.045;state.shake=event.power?.10:.06;damageNumbers.show(event.target,event.damage);burst(event.target.position.clone().add(new THREE.Vector3(0,event.target.height,.1)),'#f8e3a5');
      if(!event.periodic)progress.addSkillXP(event.skill??(event.kind==='sword'?'sword':'unarmed'),3);
      const attacker={id:'player',position:player.position,weapon:combat.weapon,strikes:combat.combo,action:combat.action};event.target.recentAttacker=population.living.player.target;event.target.recentAttackUntil=Date.now()+12000;recordHitImpact(event.target,attacker,event.damage);population.blood.hit(event.target,attacker,event.damage,player.position);
      townLife.recordHit(event.target,attacker,event.damage);
      simulation.factions.harm(event.target,{id:'player',factionId:'mosswake',level:progress.data.level});addStatus(event.target,event.effect,event.target.simulation?.time??elapsed);if(event.target.person)population.living.playerAttacks(event.target);progress.save();
      event.target.ownerUntil=Date.now()+6000;
      if(event.dead){simulation.society.relationships.recordKill(event.target.kind);simulation.society.recordBountyKill('player',event.target);if(event.target.person?.type==='adventurer'){recordPlayerKill(progress.data.pvp);progress.save();}population.defeat(event.target,Date.now(),{...population.living.player.target,level:progress.data.level,factionId:'mosswake'});const reward=progress.recordKill(event.target.kind);population.contracts.recordKill('player',event.target);if(reward){progress.data.coins+=simulation.society.contribute('player','kill',event.target.position,Date.now());progress.save();state.kills++;message(`+${reward.xp} XP · Loot the bag with V or click it.`,2);}}}
    if(event.type==='blocked'){damageNumbers.show(player,'Block','blocked');progress.addSkillXP('defence',4);progress.save();animator.recoil=1;state.blocks++;state.shake=.025;message('Blocked',.8);burst(player.position.clone().add(new THREE.Vector3(Math.sin(player.yaw)*.4,1.3,Math.cos(player.yaw)*.4)),'#b3e2ed');}
    if(event.type==='target-blocked'){damageNumbers.show(event.target,'Block','blocked');event.target.blockAt=event.target.simulation?.time??elapsed;}
    if(event.type==='hurt'){damageNumbers.show(player,event.damage,'incoming');skillAction.cancel();state.shake=.12;message(`Hit −${event.damage}`,1);}
  }
}
function updateHUD(){
  const target=state.lock,kind=isWeapon(combat.weapon)?'sword':'punch',range=Boolean(target&&inAttackRange(player.position,target,mountedAttack(kind==='sword'?weaponAction(combat.weapon):ACTIONS[kind],{mounted:mounts.mounted}).reach));
  $('#target-card').hidden=!target;
  if(target){$('#target-name').textContent=`${target.name} · Lv ${target.level}`;$('#target-health').style.width=`${target.hp/target.maxHp*100}%`;$('#target-status').textContent=`${target.hp} / ${target.maxHp} HP · ${targetDistance(player.position,target).toFixed(1)} m · ${range?(state.autoAttack?'Attacking':'In range'):'Out of range — move closer'}`;}
  const selected=target??friendlyTargets().find(t=>t.person===state.friendly);
  targeting.update(selected,range,state.autoAttack&&range);
  if(!target&&selected)targeting.ring.material.color.set(selected.person.type==='adventurer'?'#91ccf2':'#a8d78e');
  updateAttackIcon(combat.weapon);
  $('#attack').classList.toggle('active',state.autoAttack);$('#attack small').textContent=state.autoAttack?'Click to stop':'Start auto attack';
  player.xp=progress.data.xp;player.level=progress.data.level;
  $('#health-bar').style.width=`${combat.hp}%`;$('#stamina-bar').style.width=`${Math.max(0,combat.stamina)}%`;$('#xp-bar').style.width=`${player.xp/levelThreshold(player.level)*100}%`;$('#level').textContent=String(player.level).padStart(2,'0');
  const activity=state.lab?`PREVIEW / ${state.lab.toUpperCase()}`:combat.action?`${combat.action.kind.toUpperCase()} / ${combat.action.side}`:combat.block?'GUARD':player.speed>2?'RUN':player.speed>.15?'WALK':animator.idleTime>7?'CHILL':'IDLE';
  $('#state-label').textContent=(input.autoRun?'AUTORUN · ':'')+activity;
  for(const target of world.targets){
    const close=target.hp>0&&target.position.distanceToSquared(player.position)<(target.externalSimulation?144:1225);
    if(!close||target.externalSimulation&&target!==state.lock){if(target.tag)target.tag.hidden=true;continue;}
    if(!target.tag){target.tag=document.createElement('div');const name=document.createTextNode(target.name+' · Lv '+target.level),bar=document.createElement('div');bar.className='enemy-bar';bar.append(document.createElement('i'));target.tag.append(name,bar);$('#target-tags').append(target.tag);}
    const p=target.position.clone().add(new THREE.Vector3(0,target.height+.65,0)).project(camera);
    target.tag.style.display='';target.tag.hidden=p.z>1||Math.abs(p.x)>1.1;target.tag.style.left=`${(p.x*.5+.5)*innerWidth}px`;target.tag.style.top=`${(-p.y*.5+.5)*innerHeight}px`;target.tag.querySelector('i').style.width=`${target.hp/target.maxHp*100}%`;target.tag.style.color=target===state.lock?'#ffe4a5':'#f5f2df';
  }
  worldUI.update(elapsed);
  mmoHUD.update(elapsed);societyPanel.update(elapsed);lootPanel.update();
  mountButton.classList.toggle('active',mounts.mounted);mountButton.textContent=mounts.mounted?'Dismount · H':'Mount · H';
  const cast=skillAction.current;castBar.hidden=!cast;
  if(cast){castBar.querySelector('span').textContent=cast.definition.label;castBar.querySelector('i').style.width=`${cast.elapsed/cast.definition.duration*100}%`;}
}
function updateCamera(dt){
  if(state.mode==='create'){
    if(camera.fov!==43){camera.fov=43;camera.updateProjectionMatrix();}
    const target=state.closeup?new THREE.Vector3(-.28,1.58,3):new THREE.Vector3(-.55,.95,3);
    const desired=state.closeup?new THREE.Vector3(.1,1.64,4.2):new THREE.Vector3(1.7,1.5,6.7);
    target.y+=world.height(0,3);desired.y+=world.height(0,3);
    camera.position.lerp(desired,1-Math.exp(-dt*5));camera.lookAt(target);return;
  }
  followMovementHeading(input,player,state,dt);
  followCamera.update(dt,player,state,state.shake);state.shake=Math.max(0,state.shake-dt*.7);
}
function frame(dt){
  if(state.paused)return;
  if(state.mode==='opening'){
    // Keep the atmosphere positioned during the town shots, before gameplay starts.
    if(opening.time>=WAKE_TIME)dayNight.update(dt,opening.position);
    opening.update(dt,state.mute);gameAudio.update(opening.woken?player.position:avatar.root.position,camera,voices.busy('cinematic'));return;
  }
  if(state.mode==='create'){
    elapsed+=dt;avatar.root.position.set(0,0,0);if(state.turn)creatorUI.controls.angle+=dt*.35;avatar.root.rotation.y=creatorUI.controls.angle;
    animator.update(dt,{speed:0,weapon:'unarmed'});wardrobe.update(dt);equipment.sword.visible=false;hairThumbnails.update(appearance);studio.update(camera,{...creatorUI.controls,closeup:state.closeup},dt);renderer.render(studio.scene,camera);return;
  }
  consumeMouseCamera(input,state,followCamera.settings.sensitivity);
  elapsed+=dt;dayNight.update(dt,player.position);world.update(elapsed,player.position,dt);guardSpeech.update();
  if(expansion.cinematic.active){expansion.cinematic.update(dt);gameAudio.update(player.position,camera,voices.busy('cinematic'));renderer.render(scene,camera);return;}
  playedSeconds+=dt;
  {
    const simulationDt=dt*(state.lab?Number($('#preview-speed').value):1);state.hitstop=Math.max(0,state.hitstop-dt);
    updatePlayer(simulationDt);updateTargets(simulationDt);
    avatar.root.position.copy(player.position);avatar.root.rotation.y=player.yaw;
    const speed=mounts.mounted?0:state.lab==='walk'?PEDESTRIAN_SPEED.walk:state.lab==='run'?PEDESTRIAN_SPEED.run:player.speed;
    animator.update(simulationDt,{speed,action:combat.action,block:combat.block||state.lab==='block',weapon:skillAction.current?'unarmed':combat.weapon,grounding:!mounts.mounted&&!state.lab&&player.grounded,airborne:!player.grounded,takeoffWeight:player.takeoffWeight,verticalSpeed:player.verticalSpeed,scrubPhase:state.lab&&$('#scrub-cycle').checked?Number($('#cycle-phase').value):undefined,travelAngle:player.speed>.12?wrapAngle(Math.atan2(player.velocity.x,player.velocity.z)-player.yaw):0});
    tradingTime=player.speed>.1?0:Math.max(0,tradingTime-simulationDt);
    if(combat.action||mounts.mounted)jobAnimation.clear();else jobAnimation.update(simulationDt,skillAction.current?.definition.animation??(tradingTime>0?'trade':'rest'),player.speed>.1);
    mounts.update(simulationDt,{weapon:combat.weapon,action:combat.action,block:combat.block});
    wardrobe.update(simulationDt);
    equipment.sword.visible=isWeapon(combat.weapon)&&combat.action?.kind!=='punch'&&!skillAction.current&&tradingTime<=0;
    handleCombatEvents();
    animator.events.length=0;
    worldSounds.update(simulationDt,player,{speed:player.speed,phase:animator.phase,action:combat.action,weapon:combat.weapon,mounted:mounts.mounted,mountPhase:mounts.horse?.phase,grounded:player.grounded,activity:skillAction.current?.definition.animation??(tradingTime>0?'trade':'rest'),jobTime:skillAction.current?.definition.animation==='chop'?jobAnimation.actionTime:jobAnimation.time});
    trail.update(simulationDt,!weaponAction(combat.weapon).ranged&&combat.action?.kind==='sword'&&combat.action.progress>.29&&combat.action.progress<.66);
    playerPanels.update(simulationDt,elapsed);
  }
  if(messageTimer>0){messageTimer-=dt;if(messageTimer<=0)$('#message').classList.remove('show');}
  for(let i=effects.length-1;i>=0;i--){const e=effects[i];e.life-=dt;e.velocity.y-=dt*5;e.mesh.position.addScaledVector(e.velocity,dt);e.mesh.scale.setScalar(Math.max(0,e.life/e.max));if(e.life<=0){e.mesh.removeFromParent();e.mesh.geometry.dispose();e.mesh.material.dispose();effects.splice(i,1);}}
  updateCamera(dt);
  gameAudio.update(player.position,camera,['dialogue','guard','cinematic'].some(channel=>voices.busy(channel)));
  for(const zone of expansion.zones.zones)if(zone.runtime?.overlays){const overlay=zone.runtime.overlays;overlay.select(state.lock?.battleOverlay===overlay?state.lock:null);overlay.update({enabled:state.mode==='play'&&!input.drag});}
  updateWorldHover();
  for(const event of population.living.damageEvents.splice(0))if(state.mode==='play'){
    gameAudio.play(typeof event.amount==='number'?'hit':'metal',event.target.position,{volume:.8});
    const options=event.target.battleOverlay?.damageOptions(event.target);
    if(!event.target.battleOverlay||options)damageNumbers.show(event.target,event.amount,'world',options??{});
  }
  damageNumbers.update(dt,innerWidth,innerHeight);
  for(const shot of population.living.projectileEvents??[])projectiles.add(shot);if(population.living.projectileEvents)population.living.projectileEvents.length=0;projectiles.tick(dt);
  population.blood.update(dt,player.position);
  factionLandmarks.update(elapsed,player.position);population.corpses.update(Date.now(),player.position);
  if(state.mode==='play'){updateHUD();chat.update(elapsed);timeLabel.textContent=`${dayNight.clock.night?'☾':'☀'} Day ${dayNight.clock.day} · ${dayNight.clock.label}`;}renderer.render(scene,camera);
}
function startGather(node){
  if(mounts.mounted){message('Dismount with H before gathering.',3);return false;}
  const definition=GATHERING[node.kind];
  if(definition.tool&&!progress.hasItem(definition.tool)){message('Buy '+progress.item(definition.tool).name.toLowerCase()+' from Orin and keep it in your bag.',4);return false;}
  if(!progress.canAddItem(node.kind,definition.yield??1)){message('Your bag is full.',3);return false;}
  if(Math.hypot(node.x-player.position.x,node.z-player.position.z)>2){message('Move closer to gather.',2);return false;}
  if(combat.action||!player.grounded){message('Finish your current action first.',2);return false;}
  selectEnemy(null);return skillAction.start(node,player.position);
}
function useSkill(id){
  const recipe=RECIPES.find(r=>r.skill===id);if(recipe){const station=world.workstations.get(recipe.station,player.position);if(station.canUse(player.position))worldUI.workstation(station);else message(`Use ${station.name.toLowerCase()} at ${station.building}. Look for the blue workshop markers on your map.`,5);return;}
  if(id==='sword'||id==='unarmed'){if(weapon(id==='sword'?'sword':'unarmed'))toggleAttack();}
  else if(id==='archery')message('Equip a bow and keep arrows in your bag. Land shots to train Archery.',4);
  else if(id==='fletching')message('Pull blue-flowered flax southeast of town. Use the loom for strings and the carpenter’s bench for bows and arrows.',6);
  else if(id==='defence')message('Defence improves when you block during combat.',3);
  else if(id==='trading')message('Take gathered materials to Orin at the market.',3);
  else{const node=world.resources.nearest(player.position);if(node&&GATHERING[node.kind].skill===id)startGather(node);else message('Move beside a matching resource and press V.',3);}
}
const playerPanels=createPlayerPanels({avatar,registry,materials:gearMaterials,progress,appearance,combat,onEquipmentChange:()=>{applyAppearance();weapon(progress.data.weapon);},onAppearance:editAppearance,onSkill:useSkill,message});
const worldUI=createWorldUI({expansion,voices,dialogue,mounts,onSpeak:(person,text)=>{unlockAudio();return voices.speak(person,text);},population,resources:world.resources,workstations:world.workstations,progress,registry,player,camera,onEquipmentChange:applyAppearance,onWeaponChange:weapon,playerPanels,onGather:startGather,onTrade:()=>tradingTime=1.3,onCraft:(recipe,station)=>{if(mounts.mounted||!station.canUse(player.position)||!population.navigation.segmentClear(player.position,station.position)||!craftedBag(progress,recipe)||!player.grounded||combat.action)return false;selectEnemy(null);return skillAction.startRecipe(recipe,station,player.position);},message});
const mmoHUD=createMMOHud({player,combat,state,progress,population,worldUI,world});
const cameraOptions=createCameraSettings({controller:followCamera,storage:localStorage,onOpen:()=>input.clear()});
const lootPanel=createLootPanel({corpses:population.corpses,progress,player,message});
const factionPanel=createFactionPanel({factions:simulation.factions,progress,population,player,message});
window.addEventListener('keydown',event=>{if(event.code==='KeyV'&&!event.repeat&&!/INPUT|SELECT|TEXTAREA/.test(event.target.tagName)&&state.mode==='play'&&!state.paused){const loot=population.corpses.nearest(player.position);if(loot)lootPanel.show(loot);else if(factionLandmarks.near(player.position))message(factionLandmarks.interact(player.position),5);}});
const societyPanel=createSocietyPanel({simulation,population,progress,player,message});
const updateAttackIcon=decorateHotbar();
const mountButton=document.createElement('button');mountButton.className='utility-action';mountButton.textContent='Mount · H';mountButton.dataset.tooltip='Mount / dismount · H\nCall your selected horse outdoors. Stand still to mount. Hold Shift to canter.';mountButton.onclick=()=>mounts.toggle();$('#hotbar').append(mountButton);
createObjectiveHUD($('#hud'));
const castBar=document.createElement('div');castBar.className='skill-cast';castBar.hidden=true;castBar.innerHTML='<span></span><div><i></i></div>';$('#hud').append(castBar);
installTooltips();
const hover=document.createElement('div');hover.className='world-hover';hover.hidden=true;document.body.append(hover);let hoverPointer=null;
canvas.addEventListener('pointermove',event=>{hoverPointer={clientX:event.clientX,clientY:event.clientY};});
function updateWorldHover(){
  if(!hoverPointer||state.mode!=='play'||state.paused||input.drag){hover.hidden=true;canvas.style.cursor='default';return;}
  const event=hoverPointer;
  const picked=targeting.pick(event.clientX,event.clientY,player.position,[...population.corpses.picks(player.position),...world.targets,...friendlyTargets(),...resourceTargets(),...stationTargets()]);
  hover.hidden=!picked;canvas.style.cursor=picked?.loot||picked?.person||picked?.station?'pointer':picked?.node?'grab':picked?'crosshair':'default';
  if(!picked)return;
  if(picked.battleOverlay){hover.hidden=true;return;}
  hover.textContent=picked.loot?`${picked.name}\nClick or press V to loot`:picked.station?`${picked.station.name} · ${picked.station.building}\nClick or press V beside the workbench`:picked.person?`${picked.person.name} · ${picked.person.type==='adventurer'?'Player':'NPC'}\n${picked.person.activity??picked.person.role}\nClick to select${picked.person.type==='adventurer'?'':' or talk nearby'}`:picked.node?`${picked.node.tree?'Standing tree · Axe required':progress.item(picked.node.kind).name}\n${picked.node.tree?'Chop for wood':picked.node.remaining+' gathers left'} · Click or press V nearby`:`${picked.name} · Level ${picked.level}\nClick to target and attack`;
  hover.style.left=Math.min(innerWidth-290,event.clientX+18)+'px';hover.style.top=Math.min(innerHeight-100,event.clientY+18)+'px';
}
canvas.addEventListener('pointerleave',()=>{hoverPointer=null;hover.hidden=true;canvas.style.cursor='default';});
for(const [selector,text]of Object.entries({'#attack':'Attack · 1 / J\nFind the nearest enemy when none is selected. Toggle automatic attacks with your equipped weapon. Move into range to strike.','#edit-character':'Character · C\nView equipment, your character and combat stats.','#health-bar':'Health\nReturn to town if you need a safe place to recover.','#stamina-bar':'Stamina\nAttacks and dodging spend stamina. Resting restores it.'}))$(selector).dataset.tooltip=text;
for(const [page,key]of Object.entries({bag:'B',character:'C',skills:'K',quests:'L',friends:'O',map:'M',activity:''}))$(`[data-panel="${page}"]`).dataset.tooltip=`${page[0].toUpperCase()+page.slice(1)}${key?' · '+key:''}\nOpen your ${page}.`;
let playedSeconds=session.entry.playSeconds??0;
async function saveSession(){if(state.mode==='play')progress.data.position=player.position.toArray();await expansion.save();progress.save();simulation.save();updateSession({level:progress.data.level,playSeconds:playedSeconds});}
const gameMenu=createGameMenu({
  getCharacter:()=>({name:appearance.name,level:progress.data.level,location:inHighmere(player.position.x,player.position.z)?'Highmere':inTown(player.position.x,player.position.z)?'Mosswake':'The forest'}),
  getSavedAt:()=>session.entry.updatedAt,
  onPause:paused=>{
    state.paused=paused;voices.setPaused(paused);gameAudio.setPaused(paused);input.enabled=!paused&&state.mode==='play';input.clear();input.lookX=input.lookY=input.zoom=0;
    if(paused){chat.close();societyPanel.close();cameraOptions.close();playerPanels.close();worldUI.close();factionPanel.close();lootPanel.close();expansion.close();hover.hidden=true;}
  },
  onSave:()=>{saveAppearance();return saveSession();},
  onLogOff:()=>{
    renderer.setAnimationLoop(null);voices.dispose();gameAudio.dispose();input.enabled=false;input.clear();audio?.suspend();
    try{sessionStorage.setItem('forest-reborn-logged-off','1');}catch{}
    location.reload();
  },
});
createAudioSettings(gameAudio);
const dev={
  level(value){if(!Number.isInteger(value)||value<1||value>100)return false;progress.data.level=value;progress.data.xp=0;applyAppearance();combat.hp=100;progress.save();message(`Level ${value}`,2);return true;},
  time(value){if(!Number.isFinite(value)||value<0||value>24)return false;dayNight.clock.setHour(value);progress.save();return true;},
  teleport(x,z){if(!Number.isFinite(x)||!Number.isFinite(z)||Math.abs(x)>1950||Math.abs(z)>1950)return false;mounts.reset();selectEnemy(null);input.clear();player.position.set(x,world.height(x,z),z);player.velocity.set(0,0,0);player.verticalSpeed=0;player.grounded=!state.fly;followCamera.reset();progress.data.position=player.position.toArray();return true;},
  fly(enabled){state.fly=Boolean(enabled);mounts.reset();selectEnemy(null);input.clear();player.velocity.set(0,0,0);if(!state.fly){player.position.y=world.height(player.position.x,player.position.z);player.grounded=true;}message(state.fly?'Flight enabled · Space up · Ctrl down · Shift fast':'Flight disabled',4);},
  heal(){combat.hp=100;combat.stamina=100;},gold(amount){progress.data.coins+=Math.round(amount*10000);progress.save();message(`Added ${amount} gold`,2);},raid:()=>townLife.forceRaid(),
};
const chat=createChat({hud:$('#hud'),player,population,progress,world,input,state,appearance,dev,voices});
const timeLabel=document.createElement('span');timeLabel.className='world-time';$('#hud .top-actions').append(timeLabel);
installGameWindows($('#hud'));
setInterval(()=>saveSession().catch(error=>{console.error(error);message('Saving failed. Please try Save progress again.',5);}),30000);
window.addEventListener('beforeunload',()=>{if(state.mode==='play')progress.data.position=player.position.toArray();progress.save();simulation.save();});
window.addEventListener('resize',()=>{renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();if(state.paused)renderer.render(scene,camera);});renderer.setSize(innerWidth,innerHeight);
camera.position.set(.8,1.25,3.3);$('#loading').hidden=true;$('#creator').hidden=false;
if(session.entry.stage==='world')enterWorld();
else if(session.entry.stage==='opening'){$('#enter').innerHTML='Continue opening <span>→</span>';}
let previous=performance.now();renderer.setAnimationLoop(now=>{const dt=THREE.MathUtils.clamp((now-previous)/1000,0,.05);previous=now;frame(dt);});
window.gameDemo={ready:true,avatar,player,combat,state,world,animator,input,enter,frame,weapon,appearance,equipment,wardrobe,camera,followCamera,renderer,scene,progress,simulation,population,worldUI,playerPanels,societyPanel,skillAction,startGather,saveSession,selectEnemy,targeting,requestAttack,toggleAttack,opening,session,creatorUI,gameMenu,voices,gameAudio,worldSounds,expansion,mounts,dialogue,factionPanel,lootPanel,factionLandmarks,dayNight,townLife,chat,dev};



