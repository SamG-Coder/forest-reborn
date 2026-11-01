import * as THREE from 'three';
import {terrainHeight} from './terrain.js';
import {createSheep} from './livestock.js';
import {publicUrl} from '../assets/public-url.js';

export const RESOURCE_SITES=Object.freeze([
  ...[[34,57],[38,60],[42,56],[45,64],[48,58],[35,65],[51,65],[40,69],[846,-736],[852,-739],[858,-733]].map(([x,z],i)=>({id:'flax-'+i,kind:'flax',x,z,regrowth:120000})),
  ...[[28,53],[48,70],[26,62],[56,58]].map(([x,z],i)=>({id:'feathers-'+i,kind:'feather',x,z,capacity:2,regrowth:120000})),
  {id:'herbs-1',kind:'herbs',x:43,z:48},{id:'herbs-2',kind:'herbs',x:48,z:45},{id:'herbs-3',kind:'herbs',x:39,z:51},
  {id:'herbs-4',kind:'herbs',x:-48,z:17},
  {id:'ore-1',kind:'iron',x:58,z:-50},{id:'ore-2',kind:'copper',x:63,z:-46},
  {id:'ore-3',kind:'iron',x:67,z:-53},{id:'coal-1',kind:'coal',x:70,z:-50},
  {id:'berries-1',kind:'berries',x:15,z:51},{id:'berries-2',kind:'berries',x:-12,z:51},{id:'berries-3',kind:'berries',x:18,z:57},{id:'berries-4',kind:'berries',x:-15,z:58},
  {id:'sheep-1',kind:'wool',x:29,z:34,capacity:1,regrowth:240000},{id:'sheep-2',kind:'wool',x:33,z:38,capacity:1,regrowth:240000},{id:'sheep-3',kind:'wool',x:37,z:33,capacity:1,regrowth:240000},
]);
export const RESOURCE_PRICES=Object.freeze({flax:2,feather:1,herbs:3,wood:2,iron:5,copper:4,rabbitHide:2,goblinScrap:4,wool:2,berries:2,coal:2});
export function sellInventory(actor,stock){
  let coins=0;for(const [kind,count] of Object.entries(actor.inventory)){coins+=(RESOURCE_PRICES[kind]??1)*count;stock[kind]=(stock[kind]??0)+count;}
  actor.coins+=coins;actor.inventory={};return coins;
}
export class ResourceLedger {
  constructor(snapshot=[]){this.nodes=RESOURCE_SITES.map(site=>({...site,remaining:site.capacity??3,readyAt:0,...snapshot.find(n=>n.id===site.id)}));}
  update(now){for(const node of this.nodes)if(node.remaining===0&&now>=node.readyAt){node.remaining=node.capacity??3;node.readyAt=0;}}
  harvest(id,position,now){
    this.update(now);const node=this.nodes.find(n=>n.id===id);
    if(!node||node.remaining<=0||Math.hypot(position.x-node.x,position.z-node.z)>2)return null;
    node.remaining--;if(!node.remaining)node.readyAt=now+(node.regrowth??90000);return node.kind;
  }
  snapshot(){return this.nodes.map(({id,remaining,readyAt})=>({id,remaining,readyAt}));}
}
export function createWorldResources(scene,surfaces,herbTexture,forest){
  const ledger=new ResourceLedger(),roots=new Map(),sheep=new Map();
  const herb=new THREE.MeshToonMaterial({map:herbTexture,alphaTest:.55,side:THREE.DoubleSide}),wood=surfaces.bark;
  const berries=new THREE.MeshToonMaterial({map:forest.textures['berry-bush'],alphaTest:.4,side:THREE.DoubleSide});
  const loader=new THREE.TextureLoader(),flaxMap=loader.load(publicUrl('/assets/world/flax.png')),featherMap=loader.load(publicUrl('/assets/ui/archery-items.png'));
  flaxMap.colorSpace=featherMap.colorSpace=THREE.SRGBColorSpace;featherMap.repeat.set(1/3,1/3);featherMap.offset.set(1/3,0);
  const flax=new THREE.MeshToonMaterial({map:flaxMap,alphaTest:.5,side:THREE.DoubleSide}),feather=new THREE.MeshToonMaterial({map:featherMap,alphaTest:.5,side:THREE.DoubleSide});
  for(const node of ledger.nodes){
    const root=new THREE.Group();root.position.set(node.x,terrainHeight(node.x,node.z),node.z);root.name=node.id;scene.add(root);roots.set(node.id,root);
    const add=(geometry,material,x,y,z)=>{const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);m.castShadow=true;root.add(m);return m;};
    if(node.kind==='wool'){sheep.set(node.id,createSheep(root,sheep.size));continue;}
    if(node.kind==='flax'){
      for(let i=0;i<3;i++){const plant=add(new THREE.PlaneGeometry(.85,.9),flax,0,.45,0);plant.rotation.y=i*Math.PI/3;plant.receiveShadow=true;}continue;
    }
    if(node.kind==='feather'){
      const patch=add(new THREE.PlaneGeometry(.65,.6),feather,0,.06,0);patch.rotation.x=-Math.PI/2;continue;
    }
    if(node.kind==='berries'){
      for(let i=0;i<3;i++){const bush=add(new THREE.PlaneGeometry(1.8,.92),berries,0,.46,0);bush.rotation.y=i*Math.PI/3;bush.receiveShadow=true;}
    }else if(node.kind==='herbs')for(let i=0;i<3;i++){
      const plant=add(new THREE.PlaneGeometry(.85,.7),herb,0,.35,0);plant.rotation.y=i*Math.PI/3;plant.receiveShadow=true;
    }else if(node.kind==='wood')for(let i=0;i<3;i++){const m=add(new THREE.CylinderGeometry(.12,.14,1.1,8),wood,0,.15+i*.08,(i-1)*.18);m.rotation.z=Math.PI/2;}
    else{
      const material=surfaces.masonry.clone();material.color.set(node.kind==='coal'?'#343838':node.kind==='iron'?'#818a8d':'#aa7754');
      for(let i=0;i<3;i++){const m=add(new THREE.DodecahedronGeometry(.34+i*.04,0),material,Math.sin(i*2)*.3,.24,Math.cos(i*2)*.3);m.scale.y=.8;}
    }
  }
  let lastEvent=null;
  const available=()=>[...ledger.nodes,...forest.treeHarvest.trees.values()].filter(n=>n.remaining>0);
  return {ledger,roots,applyEvent(event){if(!event||lastEvent===event.id)return;lastEvent=event.id;const kinds=event.type==='richSeam'?['iron','copper','coal']:event.type==='herbBloom'?['herbs','berries']:[];for(const n of ledger.nodes)if(kinds.includes(n.kind)){n.remaining=6;n.readyAt=0;}},treeHarvest:forest.treeHarvest,available,harvest(id,position,now){return id.startsWith('tree:')?forest.treeHarvest.harvest(id,position,now):ledger.harvest(id,position,now);},update(now){ledger.update(now);forest.treeHarvest.update(now);for(const node of ledger.nodes){const root=roots.get(node.id);if(sheep.has(node.id)){sheep.get(node.id).update(now/1000,node.remaining===0);continue;}root.visible=node.remaining>0;root.scale.setScalar(.65+node.remaining*.12);}},
    nearest(position,radius=2){return available().filter(n=>Math.hypot(n.x-position.x,n.z-position.z)<radius).sort((a,b)=>Math.hypot(a.x-position.x,a.z-position.z)-Math.hypot(b.x-position.x,b.z-position.z))[0]??null;}};
}
