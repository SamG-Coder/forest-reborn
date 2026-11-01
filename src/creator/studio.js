import * as THREE from 'three';

export function createStudio() {
  const scene=new THREE.Scene();scene.background=new THREE.Color('#172d39');scene.fog=new THREE.Fog('#172d39',8,24);
  scene.add(new THREE.HemisphereLight('#e5f3ff','#65717c',2.1));
  for(const [color,power,position] of [['#ffe3c3',3.2,[-3,5,4]],['#7edee8',2.4,[3,2,-2]],['#bacded',1,[0,4,-4]]]){const l=new THREE.DirectionalLight(color,power);l.position.set(...position);scene.add(l);}
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(100,100),new THREE.MeshStandardMaterial({color:'#273d49',roughness:.7}));floor.rotation.x=-Math.PI/2;floor.position.y=-.028;scene.add(floor);
  const platform=new THREE.Mesh(new THREE.CylinderGeometry(.77,.83,.04,80),new THREE.MeshStandardMaterial({color:'#4b6570',roughness:.35,metalness:.2}));platform.position.y=-.02;scene.add(platform);
  const ring=new THREE.Mesh(new THREE.TorusGeometry(.81,.003,8,100),new THREE.MeshBasicMaterial({color:'#96dddb'}));ring.rotation.x=-Math.PI/2;ring.position.y=.006;scene.add(ring);
  return {scene,update(camera,{closeup,angle=0,zoom=1},dt){
    const target=closeup?new THREE.Vector3(-.20,1.58,0):new THREE.Vector3(-.38,1.02,0);
    const dest=closeup?new THREE.Vector3(-.02,1.62,1.08):new THREE.Vector3(.8,1.25,3.3*zoom);
    camera.position.lerp(dest,1-Math.exp(-dt*8));camera.lookAt(target);camera.fov=37;camera.updateProjectionMatrix();
  }};
}
