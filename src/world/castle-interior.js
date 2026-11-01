import * as THREE from 'three';
import {HIGHMERE} from './region-layout.js';
import {metricUV} from './materials.js';

export function createCastleHall(parent,{stone,wood,base}){
  const root=new THREE.Group();root.name='Highmere great hall';parent.add(root);
  const gold=new THREE.MeshStandardMaterial({color:'#bc9a52',metalness:.65,roughness:.48});
  const fabric=new THREE.MeshToonMaterial({color:'#28465e',side:THREE.DoubleSide});
  const lightMaterial=new THREE.MeshBasicMaterial({color:'#ffd293'}),paper=new THREE.MeshToonMaterial({color:'#c6b997'}),linen=new THREE.MeshToonMaterial({color:'#e2d8bd'}),colliders=[];
  function box(x,y,z,w,h,d,material=wood,solid=false){const geometry=new THREE.BoxGeometry(w,h,d);metricUV(geometry,2.5);const mesh=new THREE.Mesh(geometry,material);mesh.position.set(x,base+y,z);mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);if(solid)colliders.push({minX:HIGHMERE.x+x-w/2,maxX:HIGHMERE.x+x+w/2,minZ:HIGHMERE.z+z-d/2,maxZ:HIGHMERE.z+z+d/2});return mesh;}
  box(-12,-.04,-80,29.8,.10,22.9,stone);box(-12,6.2,-80,29.8,.3,22.9);
  box(-12,.025,-79.5,5,.015,19,fabric);
  for(const x of [-14.4,-9.6])box(x,.037,-79.5,.055,.008,19,gold);
  for(const x of [-23,-1])for(const z of [-75,-85]){
    box(x,3,z,.42,6,.42,wood,true);box(x,5.8,z,1.4,.25,.65,wood);
  }
  for(const z of [-73,-80,-87])box(-12,6,z,30,.35,.4,wood);
  // Throne, a steward's desk, and a long service table.
  box(-12,.48,-90,1.45,.18,1.1,wood,true);box(-12,1.45,-90.48,1.5,2.2,.22,wood,true);
  box(-12,1.5,-90.33,1.12,1.7,.09,fabric);
  for(const s of [-1,1]){box(-12+s*.77,1.2,-90.4,.09,2.5,.12,gold);box(-12+s*.74,.95,-90,.16,.14,1.25);}
  box(-18,.84,-78,3.4,.18,1.6,wood,true);box(-18,.955,-78,1.1,.04,.75,paper);
  for(const x of [-19.4,-16.6])for(const z of [-78.6,-77.4])box(x,.42,z,.12,.84,.12);
  box(-3,.84,-80,2.6,.18,11,wood,true);
  for(const z of [-84.6,-80,-75.4])for(const x of [-3.95,-2.05])box(x,.42,z,.17,.84,.17);
  for(const x of [-5.1,-.9])box(x,.43,-80,.55,.16,10,wood,true);
  for(const x of [-5.1,-.9])for(const z of [-84,-80,-76])box(x,.2,z,.16,.4,.4);
  for(const z of [-76,-80,-84]){box(-3,.95,z,1.7,.03,.8,fabric);for(const s of [-1,1])box(-3+s*.75,1.03,z,.22,.15,.22,gold);}
  // Pantry and linen shelves give each servant a visible workplace.
  for(const z of [-86,-73]){
    const x=z===-86?-20:-25;
    box(x,1,z,.22,2,2.4,wood,true);box(x+.5,.95,z,1.1,.12,2.4,wood,true);
    for(const y of [.2,.85,1.5]){
      box(x+.5,y,z,1.1,.1,2.4);
      for(let i=0;i<3;i++)box(x+.6,y+.16,z-.75+i*.7,.68,.22,.50,z===-86?linen:paper);
    }
  }
  // Keep the central aisle clear; deliveries wait beside the entrance.
  for(let i=0;i<3;i++)box(-23+i*.7,.25,-70,.6,.5,.65,wood,true);
  // Long fabric hangings make the audience end easy to recognise.
  for(const x of [-18,-6]){
    box(x,3.35,-90.92,2.2,3.8,.04,fabric);
    for(const side of [-1,1])box(x+side*1.02,3.35,-90.875,.055,3.8,.02,gold);
    box(x,5.3,-90.86,2.5,.08,.1,gold);
    const crest=new THREE.Mesh(new THREE.TorusGeometry(.5,.055,6,24),gold);crest.position.set(x,base+3.8,-90.84);root.add(crest);
    box(x,3.45,-90.83,.09,1.4,.02,gold);
  }
  const fixtures=[];
  for(const x of [-23,-1])for(const z of [-72,-87]){
    box(x,3.25,z,.25,.1,.25,gold);const flame=box(x,3.5,z,.12,.4,.12,lightMaterial);flame.rotation.z=.08;
    fixtures.push({root:flame,flame,position:new THREE.Vector3(HIGHMERE.x+x,base+3.4,HIGHMERE.z+z),phase:fixtures.length,alwaysOn:true,power:6.5,range:11});
  }
  return {root,colliders,fixtures,update(){},dispose(){root.removeFromParent();root.traverse(o=>o.geometry?.dispose());[gold,fabric,lightMaterial,paper,linen].forEach(m=>m.dispose());}};
}
