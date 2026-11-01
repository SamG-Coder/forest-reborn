import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {OutlineEffect} from 'three/addons/effects/OutlineEffect.js';

export function createPreviewScene(container){
 const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});renderer.setPixelRatio(Math.min(devicePixelRatio,2));
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.setClearColor('#cad1c9');container.append(renderer.domElement);
 const scene=new THREE.Scene();scene.fog=new THREE.Fog('#cad1c9',12,26);
 const camera=new THREE.PerspectiveCamera(31,1,.05,60);camera.position.set(4.0,2.7,6.8);
 const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,1.57,0);controls.enableDamping=true;controls.minDistance=1.1;controls.maxDistance=12;controls.maxPolarAngle=Math.PI*.94;
 controls.mouseButtons={LEFT:THREE.MOUSE.ROTATE,MIDDLE:THREE.MOUSE.DOLLY,RIGHT:THREE.MOUSE.PAN};
 scene.add(new THREE.HemisphereLight('#ffffff','#86988a',1.3));
 const key=new THREE.DirectionalLight('#fff1e6',1.65);key.position.set(4,7,5);key.castShadow=true;key.shadow.mapSize.set(2048,2048);Object.assign(key.shadow.camera,{left:-4,right:4,top:5,bottom:-3,near:.1,far:20});key.shadow.bias=-.0003;key.shadow.normalBias=.025;scene.add(key);
 const rim=new THREE.DirectionalLight('#cce9e8',.65);rim.position.set(-4,3,-4);scene.add(rim);
 const floor=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.MeshStandardMaterial({color:'#bec7bb',roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-.12;floor.receiveShadow=true;scene.add(floor);
 const platform=new THREE.Mesh(new THREE.CylinderGeometry(1.62,1.68,.10,96),new THREE.MeshStandardMaterial({color:'#cfd7cb',roughness:.85}));platform.position.y=-.06;platform.receiveShadow=true;scene.add(platform);
 const rimCircle=new THREE.Mesh(new THREE.RingGeometry(1.58,1.595,96),new THREE.MeshBasicMaterial({color:'#748c80',side:THREE.DoubleSide}));rimCircle.rotation.x=-Math.PI/2;rimCircle.position.y=-.003;scene.add(rimCircle);
 const grid=new THREE.GridHelper(16,32,'#9caca0','#b4c0b5');grid.position.y=-.112;grid.material.transparent=true;grid.material.opacity=.28;scene.add(grid);
 for(const mesh of [floor,platform,rimCircle])mesh.material.userData.outlineParameters={visible:false};
 const outline=new OutlineEffect(renderer,{defaultThickness:.0015,defaultColor:[.12,.15,.17]});
 const resize=()=>{const {width,height}=container.getBoundingClientRect();renderer.setSize(width,height);camera.aspect=width/height;camera.updateProjectionMatrix();};
 const observer=new ResizeObserver(resize);observer.observe(container);resize();
 const views={front:[0,2.73,2.05],back:[0,2.73,-2.05],side:[2.05,2.73,0],face:[1.45,2.73,1.45],full:[4,2.7,6.8]};
 return {scene,renderer,camera,controls,grid,
  setView(view){const p=views[view]??views.full;camera.position.set(...p);controls.target.set(0,view==='full'?1.57:2.72,0);controls.update();},
  render(){controls.update();outline.render(scene,camera);},
  dispose(){observer.disconnect();controls.dispose();renderer.dispose();}
 };
}
