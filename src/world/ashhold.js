import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {ASHHOLD} from './battle-sites.js';
import {terrainHeight} from './terrain.js';
import {createTown} from './town.js';
import {loadMaterialSet,metricUV} from './materials.js';
import {createHumanoid} from '../npc/humanoid.js';
import {createHairSystem} from '../hair/system.js';
import {flagState} from '../npc/society.js';

export async function createAshhold({scene,world,population,template,registry,gearMaterials}){
  const root=new THREE.Group();root.name='Ashhold ridge fortress';scene.add(root);
  const textures=await loadMaterialSet(['castle-limestone','castle-slate']);
  const stone=textures['castle-limestone'];stone.color.set('#aea89b');
  const cloth=new THREE.MeshToonMaterial({color:'#923f35',side:THREE.DoubleSide}),batches=new Map(),colliders=[];
  function add(g,m,x,y,z,angle=0){g.rotateY(angle);g.translate(x,y,z);metricUV(g);if(!batches.has(m))batches.set(m,[]);batches.get(m).push(g);}
  const x=ASHHOLD.x,z=ASHHOLD.z,base=terrainHeight(x,z);
  const points=Array.from({length:12},(_,i)=>{const a=i/12*Math.PI*2;return [x+Math.sin(a)*72,z+Math.cos(a)*64];});
  for(let i=0;i<12;i++){
    const a=points[i],b=points[(i+1)%12],mx=(a[0]+b[0])/2,mz=(a[1]+b[1])/2,length=Math.hypot(b[0]-a[0],b[1]-a[1]),angle=-Math.atan2(b[1]-a[1],b[0]-a[0]);
    const ground=terrainHeight(mx,mz);
    // The southern road enters through a real opening between the gate towers.
    if(i!==0&&i!==11){
      add(new THREE.BoxGeometry(length+1,10,2.2),stone,mx,ground+4,mz,angle);
      wallColliders(a,b);
      for(let j=0;j<length;j+=3){const t=j/length;add(new THREE.BoxGeometry(1.5,1.4,2.6),stone,a[0]+(b[0]-a[0])*t,ground+9.7,a[1]+(b[1]-a[1])*t,angle);}
    }
    if(i!==0)add(new THREE.CylinderGeometry(4.7,5.4,14,16),stone,a[0],terrainHeight(...a)+5.5,a[1]);
    if(i!==0)add(new THREE.ConeGeometry(5.8,6,16),textures['castle-slate'],a[0],terrainHeight(...a)+15.5,a[1]);
    if(i!==0)colliders.push({minX:a[0]-5.2,maxX:a[0]+5.2,minZ:a[1]-5.2,maxZ:a[1]+5.2});
  }
  function wallColliders(a,b){
    const steps=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/2);
    for(let i=0;i<=steps;i++){const t=i/steps,cx=THREE.MathUtils.lerp(a[0],b[0],t),cz=THREE.MathUtils.lerp(a[1],b[1],t);colliders.push({minX:cx-1.5,maxX:cx+1.5,minZ:cz-1.5,maxZ:cz+1.5});}
  }
  for(const side of [-1,1]){
    const a=[x+side*9,z+61],b=points[side<0?11:1],mx=(a[0]+b[0])/2,mz=(a[1]+b[1])/2,len=Math.hypot(b[0]-a[0],b[1]-a[1]),ground=terrainHeight(mx,mz),yaw=-Math.atan2(b[1]-a[1],b[0]-a[0]);
    add(new THREE.BoxGeometry(len,10,2.2),stone,mx,ground+4,mz,yaw);wallColliders(a,b);
    for(let d=0;d<len;d+=3)add(new THREE.BoxGeometry(1.5,1.4,2.6),stone,THREE.MathUtils.lerp(a[0],b[0],d/len),ground+9.7,THREE.MathUtils.lerp(a[1],b[1],d/len),yaw);
  }
  for(const side of [-1,1]){add(new THREE.CylinderGeometry(4,4.5,15,16),stone,x+side*9,base+6,z+61);add(new THREE.ConeGeometry(5,5,16),textures['castle-slate'],x+side*9,base+16,z+61);colliders.push({minX:x+side*9-4,maxX:x+side*9+4,minZ:z+57,maxZ:z+65});}
  add(new THREE.BoxGeometry(18,4,4),stone,x,base+12,z+61);
  const plots=[[-29,-16],[28,-15],[-28,22],[27,23]].map(([dx,dz],i)=>({id:'ash-building-'+i,name:['ASH COMPANY HALL','ARMOURY','SUPPLY HOUSE','BARRACKS'][i],x:x+dx,z:z+dz,w:18,d:16,h:i===0?12:6,workshop:true,tint:i,wallMaterial:'brick'}));
  const town=createTown(root,world.forest.textures.timber,world.materials,world.forest.textures['herb-v2'],{plots,name:'Ashhold courtyard',decorations:false});colliders.push(...town.colliders);
  for(const dx of [-12,12]){add(new THREE.CylinderGeometry(.08,.1,10,8),stone,x+dx,base+5,z+45);add(new THREE.PlaneGeometry(3,5),cloth,x+dx+1.5,base+7,z+45);}
  for(const [material,parts]of batches){const mesh=new THREE.Mesh(mergeGeometries(parts),material);mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);parts.forEach(g=>g.dispose());}
  world.extraColliders.push(...colliders);population.navigation.add(ASHHOLD.id,colliders,ASHHOLD,100);
  const residents=[];
  for(let i=0;i<8;i++){
    const actor=await createHumanoid(template,registry,gearMaterials,{outfit:['clothes.traveller-red','legs.guard','shoes.guard',i<3?'body.highmere-plate':'body.leather-vest','tabard.ash'],skin:i%2?'#ba8f70':'#e0b995',face:i%5});
    const hair=await createHairSystem(actor.avatar,template.gearTemplates.helmet);hair.setStyle(i%2?'swept':'short');hair.setColor(i%3?'#2c2220':'#805138');
    const person={id:'ashhold-worker-'+i,name:['Marshal Varr','Quartermaster Holt','Sergeant Ansel','Tarin','Oren','Nessa','Lenn','Fenn'][i],role:i<3?'Ash Company officer':'Company staff',factionId:'ash',type:'worker',externalSchedule:true,actor,position:actor.root.position,home:new THREE.Vector3(x+(i%2?1:-1)*13,base,z-22+i*6),activity:i%3===0?'Checking supplies':i%3===1?'Moving stores':'On watch',clock:i*3};
    person.position.copy(person.home);person.target={id:person.id,name:person.name,person,kind:'resident',root:actor.root,position:person.position,height:1.3,level:9,hp:150,maxHp:150,pvp:flagState(),materials:[actor.avatar.materials.skin]};root.add(actor.root);residents.push(person);population.residents.push(person);
  }
  return {root,residents,update(dt,observer){town.update(observer);for(const p of residents){
    if(p.target.hp<=0){p.deadAt??=Date.now();if(Date.now()-p.deadAt>45000){population.corpses.restore(p.target);p.target.hp=p.target.maxHp;p.deadAt=null;}p.actor.root.visible=false;continue;}
    p.actor.root.visible=p.position.distanceTo(observer)<120;p.clock+=dt;
    const walking=p.activity==='Moving stores',goal=p.home.clone();if(walking)goal.z+=Math.sin(p.clock*.09)*10;
    const distance=goal.distanceTo(p.position),speed=walking&&distance>.05?Math.min(1,distance/dt):0;
    if(speed){const delta=goal.sub(p.position).normalize();p.position.addScaledVector(delta,speed*dt);p.actor.root.rotation.y=Math.atan2(delta.x,delta.z);}
    p.position.y=terrainHeight(p.position.x,p.position.z);if(p.actor.root.visible)p.actor.update(dt,{speed,activity:walking?'carry':'read'});
  }},dispose(){for(const p of residents){population.residents.splice(population.residents.indexOf(p),1);p.tag?.remove();p.actor.dispose();}population.navigation.remove(ASHHOLD.id);for(const c of colliders){const i=world.extraColliders.indexOf(c);if(i>=0)world.extraColliders.splice(i,1);}town.dispose?.();root.traverse(m=>m.geometry?.dispose());root.removeFromParent();Object.values(textures).forEach(m=>m.dispose());cloth.dispose();}};
}
