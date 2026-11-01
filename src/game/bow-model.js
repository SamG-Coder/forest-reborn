import {createArrowGeometry} from './arrow-model.js';
import * as THREE from 'three';
import {SWORD_GRIP,swordGripOrientation} from './weapon-sockets.js';

export const BOW_GRIP=Object.freeze([.074,-.026,.002]);
export const NOCK_GRIP=Object.freeze([-.074,-.026,.002]);

export function createBowModel(warbow=false){
  const root=new THREE.Group(),half=warbow?.76:.57;
  const wood=new THREE.MeshStandardMaterial({color:warbow?'#604027':'#9c6337',roughness:.68}),leather=new THREE.MeshStandardMaterial({color:'#392923',roughness:.9}),horn=new THREE.MeshStandardMaterial({color:'#ded3b4',roughness:.55});
  const points=[];
  for(let i=0;i<=24;i++){
    const t=i/24,y=(t*2-1)*half,z=.055*Math.sin(Math.PI*t)-.12*Math.abs(t*2-1)**3;
    points.push(new THREE.Vector3(0,y,z));
  }
  const curve=new THREE.CatmullRomCurve3(points),limb=new THREE.Mesh(new THREE.TubeGeometry(curve,48,.017,7,false),wood);limb.castShadow=true;root.add(limb);
  const handle=new THREE.Mesh(new THREE.CylinderGeometry(.022,.024,.16,10),leather);root.add(handle);
  for(const side of [-1,1]){const tip=new THREE.Mesh(new THREE.CylinderGeometry(.013,.016,.075,8),horn);tip.position.set(0,side*(half-.035),-.105);root.add(tip);}
  for(let i=0;i<7;i++){const wrap=new THREE.Mesh(new THREE.TorusGeometry(.024,.002,4,10),horn);wrap.rotation.x=Math.PI/2;wrap.position.y=-.065+i*.021;root.add(wrap);}
  root.userData.length=half*2;root.userData.half=half;root.userData.blade=limb;
  return root;
}

/** Endpoints follow the bow hand; the nocking point follows the drawing hand.
 * These skin weights also survive the shared instanced NPC conversion. */
export function createBowString(avatar,half){
  const {rig}=avatar,positions=[],ids=[],weights=[],indices=[];
  const socketQ=swordGripOrientation(),left=new THREE.Vector3(...BOW_GRIP),right=new THREE.Vector3(...NOCK_GRIP);
  for(const [bone,point]of [
    ['handL',new THREE.Vector3(0,half,-.12).applyQuaternion(socketQ).add(left)],
    ['handR',right],
    ['handL',new THREE.Vector3(0,-half,-.12).applyQuaternion(socketQ).add(left)],
  ]){
    const index=rig.skeleton.bones.indexOf(rig.bones[bone]),bind=rig.skeleton.boneInverses[index].clone().invert();
    for(const side of [-1,1]){const p=point.clone();p.x+=side*.0018;p.applyMatrix4(bind);positions.push(p.x,p.y,p.z);ids.push(index,0,0,0);weights.push(1,0,0,0);}
  }
  for(let i=0;i<2;i++){const a=i*2;indices.push(a,a+1,a+2,a+1,a+3,a+2);}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(ids,4));geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(12),2));geometry.setIndex(indices);geometry.computeVertexNormals();
  const mesh=new THREE.SkinnedMesh(geometry,new THREE.MeshBasicMaterial({color:'#e4d5b1',side:THREE.DoubleSide}));mesh.name='Linen bowstring';mesh.bind(rig.skeleton,new THREE.Matrix4());mesh.frustumCulled=false;avatar.root.add(mesh);return mesh;
}

/** A nocked arrow shares the same geometry as the projectile. A visibility
 * uniform is replaced by clip phase when this material is baked for crowds. */
export function createNockedArrow(avatar){
  const geometry=createArrowGeometry();geometry.translate(0,0,.32);geometry.rotateY(-Math.PI/2);
  const shown={value:0},material=new THREE.MeshBasicMaterial({vertexColors:true});
  material.userData.heldArrow=true;
  material.onBeforeCompile=shader=>{
    shader.uniforms.heldArrowVisible=shown;
    shader.vertexShader='varying float heldArrowShown; uniform float heldArrowVisible;\n'+shader.vertexShader;
    shader.fragmentShader='varying float heldArrowShown;\n'+shader.fragmentShader;
    shader.vertexShader=shader.vertexShader.replace('void main() {','void main() { heldArrowShown=heldArrowVisible;');
    shader.fragmentShader=shader.fragmentShader.replace('void main() {','void main() { if(heldArrowShown<.5) discard;');
  };
  material.customProgramCacheKey=()=> 'held-arrow-v1';
  const mesh=new THREE.Mesh(geometry,material);mesh.name='Nocked arrow';mesh.userData.bindBone='handR';mesh.userData.shown=shown;mesh.position.fromArray(NOCK_GRIP);
  avatar.rig.bones.handR.add(mesh);avatar.root.userData.nockedArrow=mesh;return mesh;
}
