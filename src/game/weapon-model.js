import * as THREE from 'three';
import {WEAPONS} from './weapon-catalog.js';
import {SWORD_GRIP} from './weapon-sockets.js';
import {batchStaticMeshes} from '../graphics/static-batches.js';
import {createBowModel} from './bow-model.js';

/** Shared grip origin is invariant; blade length never moves the palm socket. */
export function createWeaponModel(id='sword'){
  const spec=WEAPONS[id]??WEAPONS.sword,root=new THREE.Group();root.name=id;
  if(spec.grip==='bow')return createBowModel(spec.profile==='warbow');
  const steel=new THREE.MeshStandardMaterial({color:spec.effect?.type==='slow'?'#bbebf3':spec.effect?.type==='burn'?'#c9b4a0':'#b6c4cb',metalness:.8,roughness:.3});
  const edge=new THREE.MeshStandardMaterial({color:'#e1e9eb',metalness:.9,roughness:.2});
  const brass=new THREE.MeshStandardMaterial({color:'#b18b4a',metalness:.72,roughness:.4});
  const leather=new THREE.MeshToonMaterial({color:'#372b2a'});
  const length={dagger:.36,short:.53,arming:.72,broad:.75,sabre:.8,long:.95,rune:.85,great:1.12,spear:1.48}[spec.profile],width=spec.profile==='great'?.082:spec.profile==='broad'?.072:.052;
  const positions=[],indices=[],uv=[];
  const rings=14;
  for(let j=0;j<=rings;j++){
    const t=j/rings,y=spec.profile==='spear'?1.15+.33*t:.08+length*t,curve=spec.profile==='sabre'?t*t*.12:0,w=width*(t>.78?(1-t)/.22:1-.16*t);
    for(const [x,z]of [[-w,0],[0,.013],[w,0],[0,-.013]]){positions.push(x+curve,y,z);uv.push(t,x<0?0:1);}
    if(j)for(let k=0;k<4;k++){const a=(j-1)*4+k,b=(j-1)*4+(k+1)%4,c=j*4+k,d=j*4+(k+1)%4;indices.push(a,c,b,b,c,d);}
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();
  const blade=new THREE.Mesh(geometry,steel);root.add(blade);
  const add=(geometry,material,x,y,z=0)=>{const mesh=new THREE.Mesh(geometry,material);mesh.position.set(x,y,z);root.add(mesh);return mesh;};
  if(spec.profile==='spear')add(new THREE.CylinderGeometry(.015,.020,1.82,10),leather,0,.24);
  else {const guard=add(new THREE.BoxGeometry(spec.profile==='dagger'?.105:.24,.028,.045),brass,0,.045);guard.rotation.z=spec.profile==='sabre'?-.14:0;}
  add(new THREE.CylinderGeometry(SWORD_GRIP.radius,SWORD_GRIP.radius,spec.profile==='great'?.34:.17,12),leather,0,spec.profile==='great'?-.13:-.05);
  for(let i=0;i<8;i++)add(new THREE.TorusGeometry(SWORD_GRIP.radius+.001,.0015,4,12),brass,0,-.124+i*.019).rotation.x=Math.PI/2;
  add(new THREE.IcosahedronGeometry(.027,1),brass,0,spec.profile==='spear'?-.67:spec.profile==='great'?-.31:-.154);
  if(spec.effect){const rune=new THREE.MeshBasicMaterial({color:spec.effect.type==='slow'?'#82efff':spec.effect.type==='burn'?'#ff9c4c':'#b7d2df'});add(new THREE.BoxGeometry(.006,length*.53,.028),rune,0,.16+length*.25);}
  // Narrow central fuller and polished edge accents read at normal play distance.
  if(spec.profile!=='spear')add(new THREE.BoxGeometry(.009,length*.62,.027),edge,0,.1+length*.34);
  root.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
  batchStaticMeshes(root,{select:()=>true,cellSize:100});
  root.userData.length=length;root.userData.blade=blade;
  return root;
}

export function createShieldModel(){
  const root=new THREE.Group();root.name='shield.leftHand';root.userData.bindBone='handL';root.position.set(.04,.01,0);root.rotation.y=Math.PI/2;root.visible=false;
  const wood=new THREE.MeshStandardMaterial({color:'#594533',roughness:.84}),steel=new THREE.MeshStandardMaterial({color:'#9babb1',roughness:.35,metalness:.7});
  const face=new THREE.Mesh(new THREE.CylinderGeometry(.235,.235,.035,20),wood);face.rotation.x=Math.PI/2;root.add(face);
  const rim=new THREE.Mesh(new THREE.TorusGeometry(.225,.014,5,24),steel);rim.position.z=.021;root.add(rim);
  const boss=new THREE.Mesh(new THREE.SphereGeometry(.064,12,8,0,Math.PI*2,0,Math.PI/2),steel);boss.rotation.x=Math.PI/2;boss.position.z=.02;root.add(boss);
  root.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});return root;
}
