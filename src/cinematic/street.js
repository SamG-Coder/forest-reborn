import * as THREE from 'three';
import {loadTexture} from '../assets/load-texture.js';
import {createWetRoad} from './wet-road.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {createCar} from './car.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {PHONE_ATTACHMENT} from './phone-grip.js';
import {createStreetRain} from './rain.js';
import {carMotionAt} from './approach-motion.js';

function signTexture(lines, {background='#192e3c', color='#e6e1cc', width=512,height=256}={}) {
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d');
  ctx.fillStyle=background;ctx.fillRect(0,0,width,height);ctx.fillStyle=color;ctx.textAlign='center';
  lines.forEach((line,i)=>{ctx.font=`${i===0?'bold ':''}${i===0?40:27}px sans-serif`;ctx.fillText(line,width/2,55+i*48);});
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;return texture;
}
export async function createStreet(renderer) {
  const scene=new THREE.Scene();scene.background=new THREE.Color('#0e2030');scene.fog=new THREE.FogExp2('#0e2030',.026);
  const streetLength=640,detailLength=144;
  const ownedMaterials=[],geometries=[],textures=[];
  const textureFiles={road:['/assets/modern/asphalt.png',6,streetLength/2.2],brick:['/assets/world/wall-brick-basecolor.png',2,3],plaster:['/assets/world/plaster-basecolor.png',2,3],concrete:['/assets/world/plaster-basecolor.png',1,1]};
  const maps={};await Promise.all(Object.entries(textureFiles).map(async([name,[url,x,y]])=>{const t=await loadTexture(url);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(x,y);t.anisotropy=8;maps[name]=t;textures.push(t);}));
  const windowMap=await loadTexture('/assets/modern/window-pane.png');windowMap.colorSpace=THREE.SRGBColorSpace;windowMap.anisotropy=8;textures.push(windowMap);
  const environment=new RoomEnvironment(),pmrem=new THREE.PMREMGenerator(renderer),env=pmrem.fromScene(environment,.05);scene.environment=env.texture;scene.environmentIntensity=.24;environment.dispose();pmrem.dispose();
  const mat=(color,options={})=>{const m=new THREE.MeshStandardMaterial({color,roughness:.75,...options});ownedMaterials.push(m);return m;};
  const asphalt=mat('#87929b',{map:maps.road,bumpMap:maps.road,bumpScale:.012,roughness:.82,metalness:0}),concrete=mat('#899397',{map:maps.concrete,roughness:.75}),white=mat('#b7bcae',{roughness:.5}),glass=mat('#213946',{roughness:.12,metalness:.65}),dark=mat('#15212b'),brick=mat('#9a9293',{map:maps.brick,roughness:.7}),plaster=mat('#9b9c9f',{map:maps.plaster});
  const amber=mat('#ffc985',{emissive:'#e9a659',emissiveIntensity:2}),blue=mat('#a7daeb',{emissive:'#99cee8',emissiveIntensity:1.2});
  const windowLit=mat('#adb9c3',{map:windowMap,emissiveMap:windowMap,emissive:'#e6b983',emissiveIntensity:.7,roughness:.18,metalness:.15});
  const windowDim=windowLit.clone();windowDim.color.set('#687c91');windowDim.emissiveIntensity=.12;ownedMaterials.push(windowDim);
  function box(parent,w,h,d,x,y,z,material,rotation=0){const g=new THREE.BoxGeometry(w,h,d);geometries.push(g);const m=new THREE.Mesh(g,material);m.position.set(x,y,z);m.rotation.y=rotation;m.castShadow=m.receiveShadow=true;parent.add(m);return m;}
  function sign(parent,lines,w,h,x,y,z,options){const tex=signTexture(lines,options);textures.push(tex);const m=mat('#ffffff',{map:tex,emissive:'#ffffff',emissiveMap:tex,emissiveIntensity:.5});return box(parent,w,h,.025,x,y,z,m);}
  scene.add(new THREE.HemisphereLight('#89a9cf','#16202c',.85));
  const moon=new THREE.DirectionalLight('#a5c9ee',1.1);moon.position.set(-4,12,8);scene.add(moon);
  // A continuous ground and road extend well beyond the fog horizon in every shot.
  box(scene,900,.15,900,0,-.24,0,dark);
  const road=box(scene,13,.18,streetLength,0,-.13,0,asphalt);road.name='continuous-asphalt-road';
  const reflector=createWetRoad({length:streetLength});scene.add(reflector);
  for(const side of [-1,1]){
    box(scene,3.8,.25,streetLength,side*7.7,-.025,0,concrete);
    for(let z=-detailLength/2;z<detailLength/2;z+=1.1){box(scene,.18,.27,1.04,side*5.8,-.015,z,white);for(const x of [6.4,7.6,8.8])box(scene,1.15,.014,1.04,side*x,.108,z,concrete);}
    for(let n=-8;n<=8;n++){
      const z=n*9+3, height=6+((n+9)%3)*2,floors=Math.floor((height-.45)/2);
      box(scene,6,height,8,side*12,height/2,z,n%2?brick:plaster);
      box(scene,6.12,.18,8.1,side*12,height+.03,z,dark);
      box(scene,.13,.14,8.1,side*8.92,height-.25,z,dark);
      box(scene,.06,2.05,1.05,side*8.94,1.16,z-2.5,dark);
      box(scene,.025,1.30,.8,side*8.90,1.38,z-2.5,glass);
      box(scene,.07,.08,.30,side*8.86,1.10,z-2.22,white);
      for(let floor=0;floor<floors-1;floor++)box(scene,.12,.10,8.1,side*8.93,2.7+floor*2,z,white);
      for(let floor=0;floor<floors;floor++)for(let col=0;col<3;col++){
        if(floor===0&&col===0)continue;
        const lit=((n+5)*7+floor+col)%4!==0;
        const wy=1.7+floor*2,wz=z-2.5+col*2.4;
        const g=new THREE.PlaneGeometry(1.18,1.26);geometries.push(g);
        const pane=new THREE.Mesh(g,lit?windowLit:windowDim);pane.position.set(side*8.94,wy,wz);pane.rotation.y=-side*Math.PI/2;scene.add(pane);
        for(const edge of [-1,1]){box(scene,.06,1.38,.055,side*8.91,wy,wz+edge*.615,dark);box(scene,.06,.055,1.28,side*8.91,wy+edge*.657,wz,dark);}
        box(scene,.06,1.30,.03,side*8.91,wy,wz,dark);
        box(scene,.12,.05,1.31,side*8.89,wy-.70,wz,white);
      }
    }
    // Far blocks carry the street into the fog without multiplying window detail.
    for(const direction of [-1,1])for(let n=0;n<12;n++){
      const z=direction*(90+n*18),height=8+(n%4)*2;
      box(scene,9,height,18,side*13,height/2,z,n%2?brick:plaster);
      box(scene,9.15,.2,18.1,side*13,height,z,dark);
    }
    for(let z=-61;z<66;z+=12){
      box(scene,.10,5.4,.1,side*5.45,2.7,z,dark);box(scene,1.1,.12,.14,side*5.0,5.35,z,dark);
      box(scene,.7,.06,.3,side*4.7,5.28,z,amber);
      if(Math.abs(z)<30){const lamp=new THREE.PointLight('#ffd19a',20,12,2);lamp.position.set(side*4.7,4.8,z);scene.add(lamp);}
    }
  }
  for(let z=-150;z<150;z+=6)if(Math.abs(z)>5)box(scene,.12,.008,2.7,0,-.033,z,white);
  for(let x=-5.1;x<=5.1;x+=.85)box(scene,.43,.01,3.5,x,-.028,0,white);
  // Bus shelter, closed convenience store and street furniture.
  const shelter=new THREE.Group();shelter.name='road-facing-bus-shelter';shelter.position.set(8.12,.12,8);shelter.rotation.y=-Math.PI/2;scene.add(shelter);
  box(shelter,2.7,.10,1.55,0,2.6,0,dark);
  for(const x of [-1.24,1.24])for(const z of [-.61,.61])box(shelter,.065,2.6,.065,x,1.3,z,dark);
  box(shelter,2.48,2.4,.025,0,1.35,-.61,glass);
  box(shelter,1.85,.07,.4,0,.52,-.26,concrete);
  for(const x of [-.7,.7])box(shelter,.06,.5,.06,x,.25,-.26,dark);
  sign(shelter,['NIGHT SERVICE','Last bus cancelled','Next service 05:40'],1.25,.85,.55,1.82,-.57);
  sign(shelter,['BUS STOP','NIGHT LINE'],1.25,.45,0,2.35,.65);
  sign(scene,['CORNER MART','OPEN LATE'],2.3,.42,8.78,2.7,.5,{background:'#23465a',color:'#efc7a0'}).rotation.y=-Math.PI/2;
  for(const z of [-5,13])box(scene,.6,1,.6,6.2,.5,z,dark);
  const vehicle=createCar(),car=vehicle.root;scene.add(car);car.visible=false;
  const parked=[];for(const [x,z] of [[-4.4,15],[-4.4,-11]]){const p=createCar();p.root.position.set(x,0,z);p.root.traverse(o=>{if(o.isLight)o.visible=false;});scene.add(p.root);parked.push(p);}
  // Drain covers and bollards define the pavement edge at the crossing.
  for(const side of [-1,1])for(const z of [-3.2,3.2]){box(scene,.12,.88,.12,side*6.05,.55,z,dark);box(scene,.13,.05,.13,side*6.05,.79,z,white);for(let i=0;i<6;i++)box(scene,.36,.016,.035,side*5.45,-.02,z+i*.075,dark);}
  const rain=createStreetRain();scene.add(rain.root);
  return {scene,car,update(time){
    rain.update(time);
    const motion=carMotionAt(time);car.visible=motion.visible;car.rotation.y=motion.yaw;car.position.set(motion.x,0,motion.z);vehicle.update(time,motion.yaw);
  },dispose(){rain.dispose();vehicle.dispose();parked.forEach(p=>p.dispose());reflector.geometry.dispose();reflector.dispose();env.dispose();geometries.forEach(g=>g.dispose());ownedMaterials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());}};
}

export function createPhone(hand) {
  const group=new THREE.Group();group.name='opening-phone';
  const body=new THREE.Mesh(new RoundedBoxGeometry(PHONE_ATTACHMENT.width,PHONE_ATTACHMENT.height,PHONE_ATTACHMENT.depth,3,.004),new THREE.MeshStandardMaterial({color:'#101b23',roughness:.25,metalness:.5}));group.add(body);
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=1024;const ctx=canvas.getContext('2d');
  ctx.fillStyle='#142936';ctx.fillRect(0,0,512,1024);ctx.fillStyle='#dce3e4';ctx.font='24px sans-serif';ctx.fillText('23:47',34,46);ctx.font='bold 46px sans-serif';ctx.fillText('Mina',35,148);
  ctx.fillStyle='#2a4351';ctx.fillRect(28,240,380,145);ctx.fillStyle='#f3efdf';ctx.font='34px sans-serif';ctx.fillText('You off yet?',55,328);
  ctx.fillStyle='#386457';ctx.fillRect(116,428,368,139);ctx.fillStyle='#f3efdf';ctx.fillText('On my way.',146,515);
  ctx.fillStyle='#40505a';ctx.fillRect(24,855,464,86);ctx.fillStyle='#acbfc6';ctx.font='26px sans-serif';ctx.fillText('Message…',46,909);ctx.fillStyle='#d1d9d9';ctx.fillRect(171,985,170,8);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  const screen=new THREE.Mesh(new THREE.PlaneGeometry(PHONE_ATTACHMENT.width-.007,PHONE_ATTACHMENT.height-.012),new THREE.MeshBasicMaterial({map:texture}));screen.position.z=.005;group.add(screen);
  group.position.fromArray(PHONE_ATTACHMENT.position);group.rotation.set(...PHONE_ATTACHMENT.rotation);hand.add(group);group.visible=false;
  return {group,dispose(){group.removeFromParent();body.geometry.dispose();body.material.dispose();screen.geometry.dispose();screen.material.dispose();texture.dispose();}};
}
