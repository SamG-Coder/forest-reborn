import * as THREE from 'three';
import {loadMaterials} from '../materials.js';
import {buildMaleHead,HEAD} from '../model/head.js';
import fit from './head-fit.json';

const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(512,512);renderer.setClearColor('#ffffff');renderer.outputColorSpace=THREE.SRGBColorSpace;document.body.append(renderer.domElement);
const scene=new THREE.Scene(),root=new THREE.Group();scene.add(root);
const materials=await loadMaterials();
buildMaleHead((_region,name,geometry,material)=>{if(name!=='male_head_surface')return;const mesh=new THREE.Mesh(geometry,material);mesh.name=name;root.add(mesh);},materials);
scene.add(new THREE.HemisphereLight(0xffffff,0xaaaabb,1.2));const key=new THREE.DirectionalLight(0xffffff,1.3);key.position.set(-3,4,5);scene.add(key);
const scale=430/(HEAD.top-HEAD.bottom),half=256/scale;
const camera=new THREE.OrthographicCamera(-half,half,half,-half,.1,20);
const flat=new THREE.MeshBasicMaterial({color:'#000000',side:THREE.DoubleSide});
const depth=new THREE.MeshDepthMaterial({depthPacking:THREE.BasicDepthPacking,side:THREE.DoubleSide});
window.captureHead=(view,mode='texture')=>{
 const angle={front:0,threeQuarter:-(fit.threeQuarterAngle??45)*Math.PI/180,profile:-Math.PI/2}[view];
 const mesh=root.children[0],positions=mesh.geometry.attributes.position;
 let left=Infinity,right=-Infinity;
 for(let i=0;i<positions.count;i++){const projected=positions.getX(i)*Math.cos(angle)-positions.getZ(i)*Math.sin(angle);left=Math.min(left,projected);right=Math.max(right,projected);}
 const center=(left+right)/2,midY=HEAD.top-(256-30)/scale;
 const target=new THREE.Vector3(center*Math.cos(angle),midY,-center*Math.sin(angle));
 camera.position.copy(target).add(new THREE.Vector3(Math.sin(angle)*10,0,Math.cos(angle)*10));camera.lookAt(target);camera.updateMatrixWorld();
 camera.near=mode==='depth'?9.4:.1;camera.far=mode==='depth'?10.6:20;camera.updateProjectionMatrix();
 const original=mesh.material;if(mode==='mask')mesh.material=flat;if(mode==='depth')mesh.material=depth;
 renderer.render(scene,camera);const url=renderer.domElement.toDataURL('image/png');mesh.material=original;return url;
};
window.captureReady=true;
window.captureHead('threeQuarter');
