import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {createCrowd} from './crowd.js';
import './lab.css';
const $=s=>document.querySelector(s),view=$('#view');
const renderer=new THREE.WebGLRenderer({antialias:false,preserveDrawingBuffer:true});renderer.setPixelRatio(1);view.append(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color('#dbe1d8');scene.add(new THREE.HemisphereLight('#fffae9','#657561',2));const sun=new THREE.DirectionalLight('#ffffff',2);sun.position.set(10,30,10);scene.add(sun);
const camera=new THREE.PerspectiveCamera(55,1,.1,500),controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;
const ground=new THREE.Mesh(new THREE.PlaneGeometry(240,240),new THREE.MeshLambertMaterial({color:'#a6b39a'}));ground.rotation.x=-Math.PI/2;ground.position.y=-.01;scene.add(ground);
function overview(){camera.position.set(90,130,170);controls.target.set(0,0,0);controls.update();}overview();
const crowd=await createCrowd(scene,5000);let elapsed=0,last=performance.now(),paused=false,samples=[],pending=null;
const gl=renderer.getContext(),debug=gl.getExtension('WEBGL_debug_renderer_info');
const hardware=debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);
$('#count').onchange=()=>crowd.setCount(Number($('#count').value));$('#lod').onchange=()=>crowd.setLOD(Number($('#lod').value));$('#overview').onclick=overview;$('#ground').onclick=()=>{camera.position.set(0,3,15);controls.target.set(0,1,0);controls.update();};$('#freeze').onclick=()=>{paused=!paused;$('#freeze').textContent=paused?'Resume':'Pause';};
function measure(seconds=10){samples=[];return new Promise(resolve=>pending={end:performance.now()+seconds*1000,resolve});}
$('#measure').onclick=async()=>{$('#result').textContent='Measuring…';$('#result').textContent=JSON.stringify(await measure(),null,2);};
function resize(){renderer.setSize(view.clientWidth,view.clientHeight);camera.aspect=view.clientWidth/view.clientHeight;camera.updateProjectionMatrix();}new ResizeObserver(resize).observe(view);resize();
renderer.setAnimationLoop(()=>{
  const now=performance.now(),ms=now-last;last=now;if(!paused)elapsed+=Math.min(.1,ms/1000);controls.update();crowd.update(camera,elapsed,paused);renderer.render(scene,camera);
  if(pending){samples.push(ms);if(now>=pending.end){const sorted=samples.slice().sort((a,b)=>a-b),mean=samples.reduce((a,b)=>a+b,0)/samples.length;pending.resolve({...crowd.stats(),frames:samples.length,meanFrameMs:mean,p95FrameMs:sorted[Math.floor(sorted.length*.95)],averageFPS:1000/mean,drawCalls:renderer.info.render.calls,renderedTriangles:renderer.info.render.triangles,hardware,resolution:[view.clientWidth,view.clientHeight],animationSeconds:elapsed});pending=null;}}
  const s=crowd.stats();$('#stats').textContent=`Active ${s.active.toLocaleString()} / visible ${s.visible.toLocaleString()}\nLOD ${s.lodCounts.join(' / ')}\n${s.triangles.toLocaleString()} triangles\n${renderer.info.render.calls} draw calls\n${(1000/Math.max(1,ms)).toFixed(0)} FPS (current frame)\n${s.culledCells}/${s.cells} cells culled`;
});
$('#status').textContent='Ready · GPU palette skinning';window.crowdLab={ready:true,crowd,renderer,camera,scene,measure,hardware};
