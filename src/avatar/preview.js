import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createMaleAvatar } from './model.js';
import { FACE_STYLES, BODY_STYLES } from './catalog.js';
import '../body-preview/style.css';

const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setClearColor('#e1e6dd');renderer.outputColorSpace=THREE.SRGBColorSpace;
const container=document.querySelector('#viewport');container.append(renderer.domElement);
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(30,1,.01,50);
scene.add(new THREE.HemisphereLight(0xffffff,0x899c88,1.35));
const light=new THREE.DirectionalLight(0xfff5e8,1.8);light.position.set(-3,5,4);scene.add(light);
const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;
const avatar=await createMaleAvatar();scene.add(avatar.root,avatar.helper);
const views={face:{target:[0,1.645,.02],position:[0,1.645,.88]},profile:{target:[0,1.645,.02],position:[-.85,1.645,.02]},jaw:{target:[0,1.635,.02],position:[0,1.25,.76]},full:{target:[0,.93,0],position:[2.2,1.4,4]},hand:{target:[.93,1.42,.02],position:[1.05,1.75,.55]}};
views.upperSide={target:[0,1.43,0],position:[-1.45,1.43,0]};
views.upperFront={target:[0,1.43,0],position:[0,1.43,1.45]};
views.upperQuarter={target:[0,1.43,0],position:[-1.05,1.43,1.05]};
function view(name){const v=views[name];controls.target.set(...v.target);camera.position.set(...v.position);controls.update();}
view('face');
document.querySelector('#camera').add(new Option('Face profile','profile'));
document.querySelector('#camera').add(new Option('Jaw underside','jaw'));
for(const [id,label] of [['upperSide','Upper body / side'],['upperFront','Upper body / front'],['upperQuarter','Upper body / three-quarter']])document.querySelector('#camera').add(new Option(label,id));
const resize=()=>{const {width,height}=container.getBoundingClientRect();renderer.setSize(width,height);camera.aspect=width/height;camera.updateProjectionMatrix();};new ResizeObserver(resize).observe(container);resize();
for(const [i,face] of FACE_STYLES.entries()){
  const button=document.createElement('button');button.textContent=face.name;button.dataset.face=i;button.style.margin='3px';
  button.onclick=()=>{avatar.materials.setFace(i);document.querySelectorAll('[data-face]').forEach(b=>b.style.fontWeight=b===button?'bold':'normal');};document.querySelector('#faces').append(button);
}
for(const [i,body] of BODY_STYLES.entries()) document.querySelector('#body-style').add(new Option(body.name,i));
document.querySelector('#body-style').onchange=e=>avatar.materials.setBody(Number(e.target.value));
document.querySelector('#eye-color').oninput=e=>avatar.materials.setEye(e.target.value);
document.querySelector('#skin-color').oninput=e=>avatar.materials.setSkin(e.target.value);
document.querySelector('#underwear-color').oninput=e=>avatar.materials.underwear.color.set(e.target.value);
document.querySelector('#equipped').textContent='Equipped: Starter boxer briefs · underwear.male.starter';
const joint=document.querySelector('#joint');
for(const name of Object.keys(avatar.rig.bones)) joint.add(new Option(name,name));
joint.value='upperArmL';
function syncSliders(){for(const axis of ['x','y','z'])document.querySelector(`#joint-${axis}`).value=THREE.MathUtils.radToDeg(avatar.rig.bones[joint.value].rotation[axis]);}
joint.onchange=syncSliders;
for(const axis of ['x','y','z']) document.querySelector(`#joint-${axis}`).oninput=e=>{avatar.rig.bones[joint.value].rotation[axis]=THREE.MathUtils.degToRad(Number(e.target.value));};
document.querySelector('#reset').onclick=()=>{avatar.rig.reset();syncSliders();};
const armsDown=document.createElement('button');armsDown.id='arms-down';armsDown.textContent='Arms down';
armsDown.onclick=()=>{avatar.rig.reset();avatar.rig.bones.upperArmL.rotation.z=-1.4;avatar.rig.bones.upperArmR.rotation.z=1.4;syncSliders();view('upperFront');};
document.querySelector('#reset').after(armsDown);
function testPose(){avatar.rig.reset();const b=avatar.rig.bones;b.upperArmL.rotation.z=-.65;b.forearmL.rotation.y=-.7;b.upperArmR.rotation.z=.45;b.forearmR.rotation.y=.45;b.thighL.rotation.x=-.25;b.shinL.rotation.x=.45;b.head.rotation.y=.2;for(const [name,bone] of Object.entries(b))if(/^(index|middle|ring|little)[123]L/.test(name))bone.rotation.z=-.25;syncSliders();}
document.querySelector('#pose').onclick=()=>{testPose();view('full');};
document.querySelector('#skeleton').onchange=e=>avatar.helper.visible=e.target.checked;
document.querySelector('#camera').onchange=e=>view(e.target.value);
document.querySelector('#stats').textContent=`${avatar.rig.skeleton.bones.length} bones · ${FACE_STYLES.length} faces · ${BODY_STYLES.length} skin maps · shared clothing bind`;
window.maleAvatar={avatar,view,testPose,ready:true};
renderer.setAnimationLoop(()=>{controls.update();renderer.render(scene,camera);});
