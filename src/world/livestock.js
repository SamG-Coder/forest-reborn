import * as THREE from 'three';

/** A small articulated sheep. The fleece stays visible after shearing, trimmed close. */
export function createSheep(root,seed=0){
  const fleece=new THREE.MeshToonMaterial({color:'#eee5cc'}),skin=new THREE.MeshToonMaterial({color:'#756858'}),hoof=new THREE.MeshToonMaterial({color:'#373935'});
  const add=(parent,geometry,material,position,scale=[1,1,1])=>{const mesh=new THREE.Mesh(geometry,material);mesh.position.set(...position);mesh.scale.set(...scale);mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);return mesh;};
  const coat=new THREE.Group();coat.position.y=.6;root.add(coat);
  add(coat,new THREE.SphereGeometry(1,18,12),fleece,[0,0,0],[.31,.32,.48]);
  for(let i=0;i<7;i++)add(coat,new THREE.SphereGeometry(1,10,8),fleece,[Math.sin(i*2.4)*.21,.08,Math.cos(i*2.4)*.32],[.18,.23,.18]);
  const neck=new THREE.Group();neck.position.set(0,.7,.35);root.add(neck);
  add(neck,new THREE.SphereGeometry(1,14,10),skin,[0,-.03,.18],[.15,.19,.23]);
  for(const s of [-1,1]){
    const ear=add(neck,new THREE.SphereGeometry(1,10,8),skin,[s*.19,.05,.14],[.13,.035,.07]);ear.rotation.z=s*.3;
    add(neck,new THREE.SphereGeometry(.014,8,6),hoof,[s*.13,.015,.29]);
  }
  const legs=[];
  for(const x of [-.2,.2])for(const z of [-.27,.27]){
    const leg=new THREE.Group();leg.position.set(x,.49,z);root.add(leg);legs.push(leg);
    add(leg,new THREE.CylinderGeometry(.044,.034,.36,8),skin,[0,-.18,0]);
    add(leg,new THREE.BoxGeometry(.083,.075,.11),hoof,[0,-.42,0]);
  }
  const tail=add(root,new THREE.CapsuleGeometry(.055,.14,4,8),fleece,[0,.57,-.46]);tail.rotation.x=-.35;
  root.rotation.y=seed*1.7;root.name='Meadow sheep';
  return {update(time,sheared){coat.scale.setScalar(sheared?.76:1);neck.rotation.x=.3+Math.sin(time*.8+seed)*.35;tail.rotation.x=-.35+Math.sin(time*2+seed)*.1;}};
}
