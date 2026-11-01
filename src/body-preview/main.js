import * as THREE from 'three';
import {publicUrl} from '../assets/public-url.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import './style.css';

const views = ['front', 'back', 'left', 'top', 'front-quarter', 'rear-quarter'];
const container = document.querySelector('#viewport');
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(1536, 1024);
renderer.setClearColor('#e1e6dd');
renderer.outputColorSpace = THREE.SRGBColorSpace;
container.append(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-768 / 550, 768 / 550, 512 / 550, -512 / 550, .01, 30);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, (999 - 512) / 550, 0);
camera.position.set(3, 1.6, 5);
controls.update();
scene.add(new THREE.HemisphereLight(0xffffff, 0x819080, 1.3));
const light = new THREE.DirectionalLight(0xffffff, 1.8);
light.position.set(-3, 5, 4); scene.add(light);
const loader = new GLTFLoader();
const toonRamp = new THREE.DataTexture(new Uint8Array([95, 165, 220, 255]), 4, 1, THREE.RedFormat);
toonRamp.minFilter = toonRamp.magFilter = THREE.NearestFilter;
toonRamp.needsUpdate = true;
const models = Object.fromEntries(await Promise.all([
  ['depth', '/models/male-depth-body.glb'],
  ['baseline', '/models/male-silhouette-body.glb'],
  ['simplified', '/models/male-uv-body.glb'],
].map(async ([name, url]) => {
  const { scene: model } = await loader.loadAsync(publicUrl(url));
  model.traverse(node => {
    if (!node.isMesh) return;
    node.userData.textureMaterial = new THREE.MeshToonMaterial({ color: node.material.color, gradientMap: toonRamp });
    node.material = node.userData.textureMaterial;
  });
  scene.add(model); model.visible = name === 'simplified';
  return [name, model];
})));
const clay = new THREE.MeshStandardMaterial({ color: '#c4bbb0', roughness: .9 });
const wire = new THREE.MeshBasicMaterial({ color: '#315849', wireframe: true });
const wireBase = new THREE.MeshBasicMaterial({ color: '#e1e6dd', polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
for (const model of Object.values(models)) {
  const meshes=[];
  model.traverse(node => { if (node.isMesh) meshes.push(node); });
  for (const mesh of meshes) {
    const edges = new THREE.Mesh(mesh.geometry, wire);
    edges.userData.isWireOverlay = true;
    edges.visible = false; edges.renderOrder = 2;
    mesh.add(edges); mesh.userData.edges = edges;
  }
}
const maskMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
const depthMaterial = new THREE.MeshDepthMaterial();

function setView(view) {
  camera.zoom = 1;
  camera.up.set(0, 1, 0);
  const target = new THREE.Vector3(0, (999 - 512) / 550, 0);
  if (view === 'hips') {
    target.set(0, .88, 0); camera.zoom = 3.7;
    camera.position.copy(target).add(new THREE.Vector3(-5, 0, .6));
  } else if (view === 'hand' || view === 'shoulders') {
    target.set(view === 'hand' ? .91 : 0, 1.42, 0);
    camera.zoom = view === 'hand' ? 7 : 2.5;
    camera.position.copy(target).add(new THREE.Vector3(.2, 4, 2));
  } else if (view === 'bottom') {
    target.set(0, .9, 0); camera.up.set(0, 0, 1);
    camera.position.set(0, -10, 0);
  } else if (view === 'top') {
    target.set(0, .9, 0); camera.up.set(0, 0, -1);
    camera.position.set(0, 10, 0);
  } else if (view === 'orbit') {
    camera.position.set(3, 1.6, 5);
  } else {
    const angle = { front: 0, back: 180, left: -90, 'front-quarter': -45, 'rear-quarter': -135 }[view] * Math.PI / 180;
    camera.position.copy(target).add(new THREE.Vector3(Math.sin(angle) * 10, 0, Math.cos(angle) * 10));
  }
  controls.target.copy(target); camera.lookAt(target); camera.updateProjectionMatrix(); controls.update();
}

function setSurface(mode) {
  for (const model of Object.values(models)) model.traverse(node => {
    if (!node.isMesh || node.userData.isWireOverlay) return;
    node.userData.edges.visible = mode === 'wire';
    node.material = ({ clay, wire: wireBase, mask: maskMaterial, depth: depthMaterial })[mode] ?? node.userData.textureMaterial;
  });
}

const reference = document.querySelector('#reference-overlay');
for (const [value, label] of [['hand','Hand close-up'], ['shoulders','Shoulder close-up'], ['hips','Hip / thigh close-up'], ['bottom','Underside']]) {
  document.querySelector('#view').add(new Option(label, value));
}
function updateOverlay() {
  const view = document.querySelector('#view').value;
  reference.src = publicUrl(`/validation/body/${view === 'orbit' ? 'front-quarter' : view}-aligned.png`);
  reference.style.display = document.querySelector('#overlay').checked && views.includes(view) ? 'block' : 'none';
  reference.style.opacity = document.querySelector('#opacity').value;
}
document.querySelector('#view').onchange = event => { setView(event.target.value); updateOverlay(); };
document.querySelector('#surface').onchange = event => setSurface(event.target.value);
document.querySelector('#variant').onchange = event => {
  for (const [name, model] of Object.entries(models)) model.visible = name === event.target.value;
  updateStats(event.target.value);
};
document.querySelector('#variant').add(new Option('Simplified / UV working mesh', 'simplified'), 0);
document.querySelector('#variant').value = 'simplified';
document.querySelector('#overlay').onchange = updateOverlay;
document.querySelector('#opacity').oninput = updateOverlay;
controls.addEventListener('start', () => { reference.style.display = 'none'; });
for (const [i, view] of views.entries()) {
  const row = document.createElement('div'); row.className = 'ref-row';
  const source=publicUrl(`/assets/body-views/${view}.png`),depth=publicUrl(`/validation/body/${view}-depth.png`);
  row.innerHTML = `<span>${view} · ${i < 4 ? 'construction' : 'held out'}</span><a href="${source}"><img src="${source}" alt="${view} reference"></a><a href="${depth}"><img src="${depth}" alt="${view} network depth"></a>`;
  document.querySelector('#references').append(row);
}
const report = await fetch(publicUrl('/validation/body/reconstruction.json')).then(r => r.json());
const simplification = await fetch(publicUrl('/validation/body/simplification.json')).then(r => r.json());
function updateStats(variant) {
  const stats = variant === 'simplified' ? simplification.selected : variant === 'baseline' ? report.withoutDepth : report.withDepth;
  document.querySelector('#stats').textContent = `${stats.vertices.toLocaleString()} surface vertices · ${stats.triangles.toLocaleString()} triangles · closed surface`;
  document.querySelector('.download').href = publicUrl(variant === 'simplified' ? '/models/male-uv-body.glb' : variant === 'baseline' ? '/models/male-silhouette-body.glb' : '/models/male-depth-body.glb');
}
updateStats('simplified');
const uvLink = document.createElement('p');
uvLink.innerHTML = `<a href="${publicUrl('/validation/body/male-uv-layout.png')}" target="_blank">Open simplified UV layout</a><br><a href="${publicUrl('/validation/body/simplification.json')}">Shape preservation measurements</a>`;
document.querySelector('#stats').after(uvLink);
const metrics = await fetch(publicUrl('/validation/body/metrics.json')).then(r => r.json());
const scoreList = document.createElement('div');
scoreList.innerHTML = '<h2>Silhouette check</h2><p class="note">Red: reference only. Blue: mesh only. Click a score to inspect its error overlay.</p>' + views.map(view => `<p><a href="${publicUrl(`/validation/body/depth-${view}-overlay.png`)}">${view}: ${(metrics.depth[view].silhouetteIoU * 100).toFixed(1)}% overlap</a></p>`).join('');
document.querySelector('#references').before(scoreList);

// Render the actual loaded GLB for automated comparisons, at the source resolution.
window.bodyPreview = {
  ready: true, models, report,
  capture(view, mode = 'texture', variant = 'depth') {
    for (const [name, model] of Object.entries(models)) model.visible = name === variant;
    setView(view); setSurface(mode); renderer.setClearColor(0xffffff);
    renderer.render(scene, camera);
    const data = renderer.domElement.toDataURL('image/png');
    renderer.setClearColor('#e1e6dd'); return data;
  },
};
renderer.setAnimationLoop(() => { controls.update(); renderer.render(scene, camera); });
