import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';

/** Compact four-door car, modelled in metres, nose toward +Z. */
export function createCar(){
  const root=new THREE.Group();root.name='opening-car';const wheels=[];
  const paint=new THREE.MeshPhysicalMaterial({color:'#526c7e',metalness:.65,roughness:.27,clearcoat:1,clearcoatRoughness:.12});
  const glass=new THREE.MeshPhysicalMaterial({color:'#203342',metalness:.7,roughness:.13,clearcoat:1,side:THREE.DoubleSide});
  const rubber=new THREE.MeshStandardMaterial({color:'#10171b',roughness:.8}),chrome=new THREE.MeshStandardMaterial({color:'#adb8bc',metalness:.85,roughness:.24});
  const lamps=new THREE.MeshBasicMaterial({color:'#e7f4ff'}),red=new THREE.MeshBasicMaterial({color:'#e56a53'});
  const add=(g,m,p=[0,0,0])=>{const mesh=new THREE.Mesh(g,m);mesh.position.set(...p);mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);return mesh;};
  const box=(w,h,d,p,m=paint,r=.025)=>add(new RoundedBoxGeometry(w,h,d,3,r),m,p);
  const shape=new THREE.Shape();
  // X of this cross-section is -Z in car space; extrude across the vehicle width.
  shape.moveTo(2.02,.48);shape.lineTo(2.00,.83);shape.quadraticCurveTo(1.95,.98,1.47,1.02);shape.lineTo(.95,1.48);shape.quadraticCurveTo(.83,1.55,.62,1.55);shape.lineTo(-.17,1.51);shape.lineTo(-.78,1.01);shape.lineTo(-1.83,.87);shape.quadraticCurveTo(-2.1,.82,-2.12,.65);shape.lineTo(-2.04,.42);shape.lineTo(1.9,.42);shape.closePath();
  const body=new THREE.ExtrudeGeometry(shape,{depth:1.68,bevelEnabled:true,bevelThickness:.045,bevelSize:.04,bevelSegments:3,curveSegments:10});body.rotateY(Math.PI/2);body.translate(-.84,0,0);add(body,paint);
  function panel(points,mat=glass){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(points.flat(),3));g.setIndex([0,1,2,0,2,3]);g.computeVertexNormals();return add(g,mat);}
  // Sloping windscreen and rear glass sit on the cabin, not on an upright box.
  panel([[-.77,1.045,.77],[.77,1.045,.77],[.73,1.49,.18],[-.73,1.49,.18]]);
  panel([[.75,1.06,-1.43],[-.75,1.06,-1.43],[-.72,1.49,-.94],[.72,1.49,-.94]]);
  for(const side of [-1,1]){
    const x=side*.889;
    panel([[x,1.04,.65],[x,1.46,.14],[x,1.49,-.32],[x,1.04,-.32]]);
    panel([[x,1.04,-.39],[x,1.49,-.39],[x,1.46,-.91],[x,1.04,-1.36]]);
    box(.026,.05,2.17,[side*.9,1.0,-.34],rubber,.01);
    for(const z of [.12,-.9]){box(.037,.05,.16,[side*.908,.91,z],chrome,.014);box(.013,.48,.015,[side*.892,.73,z-.45],rubber,.003);}
    box(.21,.12,.25,[side*1.0,1.04,.65],paint,.04);
    for(const z of [-1.28,1.24]){
      const wheel=new THREE.Group();wheel.position.set(side*.9,.38,z);root.add(wheel);wheels.push(wheel);
      const tire=new THREE.Mesh(new THREE.TorusGeometry(.265,.09,14,40),rubber);tire.rotation.y=Math.PI/2;wheel.add(tire);
      const hub=new THREE.Mesh(new THREE.CylinderGeometry(.215,.215,.19,32),chrome);hub.rotation.z=Math.PI/2;wheel.add(hub);
      for(let i=0;i<5;i++){const spoke=new THREE.Mesh(new THREE.BoxGeometry(.205,.04,.30),rubber);spoke.rotation.x=i*Math.PI/5;wheel.add(spoke);}
      const centre=new THREE.Mesh(new THREE.CylinderGeometry(.065,.065,.21,20),chrome);centre.rotation.z=Math.PI/2;wheel.add(centre);
    }
    box(.43,.14,.07,[side*.59,.78,2.07],lamps,.035);box(.43,.13,.05,[side*.60,.83,-2.04],red,.025);
    const light=new THREE.SpotLight('#e8f2ff',12,40,Math.PI/8,.6,1.6);light.position.set(side*.59,.8,2.1);light.target.position.set(side*.6,.0,28);root.add(light,light.target);
  }
  box(1.60,.13,.12,[0,.46,2.02],rubber,.03);box(.62,.22,.07,[0,.67,2.08],rubber,.03);
  for(let i=-2;i<=2;i++)box(.53,.012,.011,[0,.62+i*.027,2.124],chrome,.001);
  box(.38,.09,.025,[0,.43,2.12],chrome,.005);
  return {root,update(time,steering=0){for(const wheel of wheels){wheel.rotation.x=time*14;wheel.rotation.y=wheel.position.z>0?THREE.MathUtils.clamp(steering*.6,-.4,.4):0;}},dispose(){const gs=new Set(),ms=new Set();root.traverse(o=>{if(o.geometry)gs.add(o.geometry);if(o.material)ms.add(o.material);});gs.forEach(g=>g.dispose());ms.forEach(m=>m.dispose());root.removeFromParent();}};
}
