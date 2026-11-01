import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {terrainHeight} from './terrain.js';
import {metricUV} from './materials.js';

/** The same definitions place props, interaction points, recipe menus and map markers. */
export const WORKSTATIONS=Object.freeze([
  {id:'weaver',name:'Loom & sewing table',building:'Weaver’s house',plot:'cottage-west',x:-38,z:-6,angle:Math.PI/2,art:0,skill:'tailoring',description:'Spin fleece, weave cloth and sew your first travelling clothes.'},
  {id:'forge',name:'Forge & anvil',building:'Smith’s yard',plot:'smith',x:23,z:24,angle:0,art:1,skill:'smithing',description:'Smelt ore and shape iron into helmets, mail and plate.'},
  {id:'alchemy',name:'Apothecary table',building:'Apothecary',plot:'apothecary',x:-22,z:17,angle:Math.PI,art:2,skill:'alchemy',description:'Prepare herbs and berries for healing draughts and tonics.'},
  {id:'kitchen',name:'Cooking hearth',building:'The Wayward Oak',plot:'tavern',x:-26,z:-23.8,angle:Math.PI/2,art:3,skill:'cooking',description:'There’s a clean pot by the fire. Bring something for the broth.'},
  {id:'carpenter',name:'Carpenter’s bench',building:'Carpenter’s house',plot:'cottage-east',x:40,z:-15,angle:-Math.PI/2,art:4,skill:'woodworking',description:'Saw gathered timber into useful planks.'},
  {id:'leatherworker',name:'Leatherworking table',building:'Smith & Leather',plot:'smith',x:25,z:16,angle:-Math.PI/2,art:5,skill:'tailoring',description:'Prepare hides, cut leather and stitch boots and armour.'},
]);

const cityPositions={forge:[818,-806.5],weaver:[885,-853.5],kitchen:[883,-806.5]};
export const HIGHMERE_WORKSTATIONS=Object.freeze(WORKSTATIONS.filter(s=>cityPositions[s.id]).map(s=>({
  ...s,x:cityPositions[s.id][0],z:cityPositions[s.id][1],angle:0,building:'Highmere · '+s.building,
})));

export function createWorkstations(scene,surfaces,timber,{definitions=WORKSTATIONS}={}){
  const root=new THREE.Group();root.name='Town workstations';scene.add(root);
  const wood=new THREE.MeshToonMaterial({map:timber,color:'#9b7752'}),dark=new THREE.MeshToonMaterial({map:timber,color:'#493928'});
  const iron=new THREE.MeshStandardMaterial({color:'#465257',metalness:.65,roughness:.57}),brass=new THREE.MeshStandardMaterial({color:'#b99c58',metalness:.5,roughness:.5});
  const cloth=new THREE.MeshToonMaterial({color:'#3c797a',side:THREE.DoubleSide}),wool=new THREE.MeshToonMaterial({color:'#e6ddc5'}),leather=new THREE.MeshToonMaterial({color:'#9b5939',side:THREE.DoubleSide});
  const ember=new THREE.MeshBasicMaterial({color:'#e79038'}),glass=new THREE.MeshToonMaterial({color:'#639384'}),colliders=[],stations=[];
  for(const definition of definitions){
    const group=new THREE.Group();group.name=definition.name;group.position.set(definition.x,terrainHeight(definition.x,definition.z),definition.z);group.rotation.y=definition.angle;root.add(group);
    const batches=new Map(),toWorld=(x,z)=>({x:definition.x+x*Math.cos(definition.angle)+z*Math.sin(definition.angle),z:definition.z-x*Math.sin(definition.angle)+z*Math.cos(definition.angle)});
    const add=(g,m,x,y,z,rotation)=>{if(m.map)metricUV(g,1.5);if(rotation)g.applyQuaternion(new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)));g.translate(x,y,z);if(!batches.has(m))batches.set(m,[]);batches.get(m).push(g);};
    const box=(m,x,y,z,w,h,d)=>add(new THREE.BoxGeometry(w,h,d),m,x,y,z);
    const cylinder=(m,x,y,z,r,h,rotation)=>add(new THREE.CylinderGeometry(r,r,h,12),m,x,y,z,rotation);
    const beam=(m,a,b,r=.035)=>{const from=new THREE.Vector3(...a),to=new THREE.Vector3(...b),v=to.clone().sub(from),g=new THREE.CylinderGeometry(r,r,v.length(),8);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize()));from.add(to).multiplyScalar(.5);add(g,m,from.x,from.y,from.z);};
    const solid=(x,z,w,d)=>{const corners=[[-1,-1],[-1,1],[1,-1],[1,1]].map(([sx,sz])=>toWorld(x+sx*w/2,z+sz*d/2));colliders.push({minX:Math.min(...corners.map(p=>p.x)),maxX:Math.max(...corners.map(p=>p.x)),minZ:Math.min(...corners.map(p=>p.z)),maxZ:Math.max(...corners.map(p=>p.z))});};
    const table=(x=0,z=0,w=2.2,d=1)=>{box(wood,x,.85,z,w,.14,d);for(const a of [-1,1])for(const b of [-1,1])box(dark,x+a*(w/2-.12),.4,z+b*(d/2-.12),.11,.8,.11);box(dark,x,.25,z,w-.2,.09,.12);solid(x,z,w,d);};
    const spool=(x,z,r=.14)=>{cylinder(wool,x,1.05,z,r,.22);cylinder(wood,x,.94,z,r+.035,.03);cylinder(wood,x,1.17,z,r+.035,.03);};
    if(definition.id==='weaver'){
      table(.6,0,1.2,1);box(cloth,.6,.94,.05,.9,.025,.7);spool(.95,-.25,.1);
      for(const x of [-1.35,.05]){box(wood,x,1.1,-.5,.10,2.2,.12);box(wood,x,.10,-.22,.16,.20,1.0);}
      for(const y of [.35,1.15,2.15])cylinder(wood,-.65,y,-.5,.07,1.45,[0,0,Math.PI/2]);
      for(let i=0;i<36;i++)beam(wool,[-1.28+i*.037,.5,-.48],[-1.28+i*.037,2.1,-.48],.007);
      box(cloth,-.65,.85,-.44,1.25,.65,.035);solid(-.65,-.4,1.5,.6);
      add(new THREE.TorusGeometry(.37,.045,8,28),wood,-1.8,.55,.03);for(let i=0;i<8;i++)beam(wood,[-1.8,.55,.03],[-1.8+Math.sin(i*Math.PI/4)*.34,.55+Math.cos(i*Math.PI/4)*.34,.03],.022);
      box(dark,-1.8,.1,0,.7,.1,.65);box(wood,-1.8,.3,0,.07,.6,.07);
      for(let i=0;i<3;i++)add(new THREE.SphereGeometry(.17,10,8),wool,1.3,.25+i*.09,-.15+i*.13);
    }else if(definition.id==='forge'){
      box(wood,0,.4,0,.8,.8,.7);box(iron,0,.9,0,1.0,.2,.45);box(iron,0,.75,0,.4,.35,.3);solid(0,0,1.2,.8);
      add(new THREE.ConeGeometry(.21,.5,12),iron,.7,.9,0,[0,0,-Math.PI/2]);beam(wood,[-.3,1.04,.1],[.15,1.04,-.1],.04);box(iron,.15,1.08,-.1,.2,.13,.12);
      box(surfaces.masonry,3.6,.55,-1,1.8,1.1,1.4);box(iron,3.6,1.11,-1,1.4,.08,1.1);solid(3.6,-1,1.8,1.4);
      box(surfaces.masonry,3.6,1.55,-1.7,1.8,2,.35);box(surfaces.masonry,3.6,2.8,-1.4,.65,1.2,.65);
      for(let i=0;i<6;i++)add(new THREE.DodecahedronGeometry(.12),ember,3.15+i*.17,1.2,-1);
      for(let i=0;i<4;i++)box(iron,2.9+i*.22,1.2,-.55,.18,.1,.34);
    }else if(definition.id==='kitchen'){
      box(surfaces.masonry,0,.12,0,1.5,.24,1.0);box(surfaces.masonry,0,1.0,-.55,1.5,2,.25);solid(0,0,1.5,1.1);
      for(const x of [-.63,.63])box(surfaces.masonry,x,.65,0,.24,1.3,1);
      box(surfaces.masonry,0,1.42,0,1.5,.25,1);box(surfaces.masonry,0,2.1,-.3,.65,1.2,.65);
      for(let i=0;i<4;i++)add(new THREE.DodecahedronGeometry(.15),ember,(i-1.5)*.22,.3,0);
      add(new THREE.SphereGeometry(.36,16,10),iron,0,.64,.06);cylinder(iron,0,.86,.06,.33,.10);cylinder(leather,0,.916,.06,.30,.01);
      for(const x of [-.38,.38])add(new THREE.TorusGeometry(.09,.02,6,14),iron,x,.76,.06,[0,Math.PI/2,0]);
      beam(wood,[.1,.94,.05],[.5,1.2,.15],.025);
    }else if(definition.id==='alchemy'){
      table();box(wood,0,1.6,-.5,2.3,.10,.5);
      for(let i=0;i<7;i++){const x=-.9+i*.28,y=i%2?1.8:1.05,z=i%2?-.5:0;add(new THREE.SphereGeometry(.10+i%3*.02,12,10),i%2?glass:brass,x,y,z);cylinder(glass,x,y+.12,z,.045,.16);cylinder(wood,x,y+.21,z,.047,.035);}
      add(new THREE.SphereGeometry(.18,12,10),surfaces.masonry,.55,1.0,.2);beam(surfaces.masonry,[.55,1.08,.2],[.72,1.28,.2],.045);
      box(cloth,-.55,.94,.2,.6,.02,.3);
    }else if(definition.id==='carpenter'){
      table(0,0,2.8,1.0);
      for(let i=0;i<4;i++)box(wood,-.2,.98+i*.07,-.1,2.1,.07,.18);
      box(iron,.65,1.12,.13,.8,.035,.22);box(dark,1.12,1.14,.13,.22,.10,.26);
      for(let i=0;i<8;i++)box(iron,.3+i*.10,1.09,.24,.055,.06,.045);
      for(let i=0;i<6;i++)box(wood,-.5,.12+i*.12,-.8,2.4,.1,.4);
      box(iron,-1.0,.84,.5,.20,.18,.2);cylinder(iron,-1.0,.75,.63,.03,.5,[0,0,Math.PI/2]);
    }else{
      table();box(leather,-.1,.94,.02,1.45,.02,.7);spool(.8,-.25,.11);
      for(const x of [-.9,.9])box(wood,x,1.25,-.55,.07,2.5,.07);
      for(const y of [.6,2.4])box(wood,0,y,-.55,1.9,.07,.07);
      const hide=new THREE.Shape();hide.moveTo(-.7,-.65);hide.lineTo(-.8,.5);hide.lineTo(-.4,.7);hide.lineTo(.4,.65);hide.lineTo(.7,.45);hide.lineTo(.65,-.6);hide.lineTo(0,-.75);hide.closePath();
      add(new THREE.ShapeGeometry(hide),leather,0,1.5,-.51);
      for(const x of [-.78,.78])for(let i=0;i<6;i++)beam(wool,[x, .85+i*.24,-.51],[Math.sign(x)*.89,.85+i*.24,-.55],.01);
      for(const x of [-.65,-.25]){cylinder(leather,x,1.12,.16,.12,.33);box(leather,x,1.0,.29,.24,.16,.28);}
    }
    for(const [material,parts] of batches){const geometry=mergeGeometries(parts);parts.forEach(p=>p.dispose());const mesh=new THREE.Mesh(geometry,material);mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);}
    const p=toWorld(definition.id==='forge'?-.8:0,1.3),position=new THREE.Vector3(p.x,terrainHeight(p.x,p.z),p.z);
    stations.push({...definition,root:group,position,canUse:point=>Math.hypot(position.x-point.x,position.z-point.z)<1.8});
  }
  return {root,stations,colliders,nearest(position){return stations.filter(s=>s.canUse(position)).sort((a,b)=>a.position.distanceToSquared(position)-b.position.distanceToSquared(position))[0]??null;},get(id,position){return stations.filter(s=>s.id===id).sort((a,b)=>position?a.position.distanceToSquared(position)-b.position.distanceToSquared(position):0)[0];},dispose(){root.removeFromParent();const materials=new Set();root.traverse(n=>{if(n.isMesh){n.geometry.dispose();materials.add(n.material);}});for(const m of materials)if(!Object.values(surfaces).includes(m))m.dispose();}};
}
