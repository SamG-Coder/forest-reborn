import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {terrainHeight} from './terrain.js';
import {metricUV} from './materials.js';

export function plotPoint(plot,x,z){const c=Math.cos(plot.angle??0),s=Math.sin(plot.angle??0);return new THREE.Vector3(plot.x+x*c+z*s,terrainHeight(plot.x,plot.z),plot.z-x*s+z*c);}

/** Furniture, beds and street fittings share the same coordinates as NPC tasks. */
export function createSettlementDetails(scene,{plots,materials,timber,city=false,dayNight}){
  const root=new THREE.Group();root.name=city?'Highmere neighbourhoods':'Mosswake neighbourhoods';scene.add(root);
  const own={wood:new THREE.MeshToonMaterial({map:timber,color:'#79583b'}),dark:new THREE.MeshToonMaterial({map:timber,color:'#3f3830'}),
    linen:new THREE.MeshToonMaterial({color:'#dfd5b5'}),blue:new THREE.MeshToonMaterial({color:'#395c6d'}),red:new THREE.MeshToonMaterial({color:'#954e42'}),
    green:new THREE.MeshToonMaterial({color:'#658343'}),gold:new THREE.MeshToonMaterial({color:'#bc9b60'}),iron:new THREE.MeshStandardMaterial({color:'#393c3e',metalness:.65,roughness:.63}),
    fruit:new THREE.MeshToonMaterial({color:'#bf663c'}),flame:new THREE.MeshBasicMaterial({color:'#ffb454'})};
  const batches=new Map(),beds=[],homes=[],fixtures=[],jobs=[],colliders=[];
  function add(g,m,p,angle=0){metricUV(g,1.6);g.rotateY(angle);g.translate(p.x,p.y,p.z);if(!batches.has(m))batches.set(m,[]);batches.get(m).push(g);}
  function box(m,p,w,h,d,angle=0){add(new THREE.BoxGeometry(w,h,d),m,p,angle);}
  const at=(p,y=0)=>p.clone().add(new THREE.Vector3(0,y,0));
  function solid(p,w,d){colliders.push({minX:p.x-w/2,maxX:p.x+w/2,minZ:p.z-d/2,maxZ:p.z+d/2});}
  function torch(p,short=false){
    const group=new THREE.Group();group.position.copy(p);root.add(group);const h=short?1.65:3.1;
    const post=new THREE.Mesh(new THREE.CylinderGeometry(.06,.1,h,8),own.iron);post.position.y=h/2;group.add(post);
    const cage=new THREE.Mesh(new THREE.CylinderGeometry(.21,.13,.32,8,true),own.iron);cage.position.y=h;group.add(cage);
    const flame=new THREE.Mesh(new THREE.SphereGeometry(.14,7,6),own.flame);flame.scale.set(.8,1.8,.8);flame.position.y=h+.12;group.add(flame);
    fixtures.push({root:group,flame,position:at(p,h+.15),phase:fixtures.length*2.39});
  }
  function bench(p,angle=0){box(own.wood,at(p,.47),2.3,.12,.55,angle);box(own.wood,at(p,.9).add(new THREE.Vector3(Math.sin(angle)*-.22,0,Math.cos(angle)*-.22)),2.3,.5,.08,angle);for(const s of [-1,1])box(own.iron,at(p,.23).add(new THREE.Vector3(Math.cos(angle)*s*.88,0,-Math.sin(angle)*s*.88)),.09,.46,.45,angle);solid(p,2.3,.6);}
  for(const [i,plot]of plots.entries()){
    const door=plotPoint(plot,0,plot.d/2+1.2),inside=plotPoint(plot,0,plot.d/2-1.0);
    torch(plotPoint(plot,1.7,plot.d/2+.7),!city);
    const home={id:plot.id,door,inside,plot,beds:[]};homes.push(home);
    const residential=plot.id.includes('home')||plot.id.startsWith('cottage')||plot.tavern||plot.id==='watch';
    if(residential)for(let n=0;n<4;n++){
      const x=(n%2?1:-1)*(plot.w/2-1.2),z=-plot.d/2+1.5+Math.floor(n/2)*2.6,p=plotPoint(plot,x,z),angle=plot.angle??0;
      box(own.dark,at(p,.25),1.14,.5,2.15,angle);box(own.linen,at(p,.51),1.05,.16,2.03,angle);
      box(i%2?own.blue:own.red,at(p,.61),1.07,.08,1.36,angle);
      box(own.linen,at(plotPoint(plot,x,z-.75),.65),.73,.18,.37,angle);
      box(own.wood,at(plotPoint(plot,x,z-1.03),.65),1.17,.95,.1,angle);
      const bed={id:plot.id+':bed:'+n,position:p,yaw:angle,home};beds.push(bed);home.beds.push(bed);
    }
    // Every facade gets a foundation course and planted doorstep rather than a bare box.
    for(const s of [-1,1]){
      const p=plotPoint(plot,s*(plot.w/2-1.4),plot.d/2+.6);box(materials.masonry,at(p,.2),1.5,.4,.65,plot.angle??0);
      for(let k=0;k<4;k++)add(new THREE.IcosahedronGeometry(.26,1),own.green,at(plotPoint(plot,s*(plot.w/2-1.4)+(k-1.5)*.31,plot.d/2+.6),.55));
    }
  }
  if(city){
    // Keep the gate-to-keep route and the fountain approaches open.
    const stalls=[[832,-818,'produce'],[872,-835,'bread'],[832,-873,'cloth'],[869,-781,'supplies']];
    for(const [i,[x,z,kind]]of stalls.entries()){
      const p=new THREE.Vector3(x,terrainHeight(x,z),z),cloth=i%2?own.blue:own.red;
      box(own.wood,at(p,.83),3.7,.16,1.35);box(own.dark,at(p,.39),3.4,.74,.9);solid(p,3.7,1.35);
      for(const s of [-1,1])box(own.dark,at(p,1.45).add(new THREE.Vector3(s*1.95,0,-.4)),.12,2.9,.12);
      box(cloth,at(p,2.92),4.3,.1,2.8);box(own.gold,at(p,2.76).add(new THREE.Vector3(0,0,1.35)),4.3,.28,.07);
      for(let k=0;k<6;k++){
        const q=at(p,1).add(new THREE.Vector3((k-2.5)*.5,0,0));
        if(kind==='cloth')box(k%2?own.linen:cloth,q,.44,.18,.75);else add(new THREE.SphereGeometry(.17,8,6),kind==='produce'?own.fruit:own.linen,q);
      }
      jobs.push({id:'market-'+kind,position:at(p).add(new THREE.Vector3(0,0,-1.25)),face:0,action:'sort',role:kind==='produce'?'Greengrocer':kind==='bread'?'Baker':kind==='cloth'?'Cloth merchant':'Quartermaster'});
      torch(at(p).add(new THREE.Vector3(-2.6,0,.6)));
    }
    for(const [x,z,angle]of [[841,-840,0],[859,-820,Math.PI],[800,-821,Math.PI/2],[900,-861,-Math.PI/2]])bench(new THREE.Vector3(x,terrainHeight(x,z),z),angle);
    for(const [x,z]of [[843,-757],[857,-757],[843,-786],[857,-862],[843,-893],[807,-885],[894,-882],[919,-831]])torch(new THREE.Vector3(x,terrainHeight(x,z),z));
    // Roadside cargo and a handcart give the porter a physical delivery destination.
    for(const [x,z]of [[813,-780],[879,-851],[826,-881]]){
      const p=new THREE.Vector3(x,terrainHeight(x,z),z);for(let k=0;k<3;k++)box(own.wood,at(p,.4+k%2*.7).add(new THREE.Vector3(k*.6,0,0)),.7,.7,.7);
    }
    const cart=new THREE.Vector3(882,terrainHeight(882,-781),-781);box(own.wood,at(cart,.65),1.6,.18,2.4);box(own.wood,at(cart,.99),1.6,.55,.12);solid(cart,2.2,2.5);
    for(const s of [-1,1]){box(own.wood,at(cart,.9).add(new THREE.Vector3(s*.77,0,0)),.1,.55,2.4);add(new THREE.TorusGeometry(.48,.075,8,14),own.dark,at(cart,.49).add(new THREE.Vector3(s*.95,0,0)),Math.PI/2);}
  }
  for(const [material,parts]of batches){const mesh=new THREE.Mesh(mergeGeometries(parts),material);parts.forEach(g=>g.dispose());mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);}
  const unregister=dayNight?.register(fixtures);
  return {root,beds,homes,jobs,colliders,fixtures,update(position){root.visible=Math.hypot(position.x-(city?850:0),position.z+(city?850:0))<(city?350:260);},dispose(){unregister?.();root.removeFromParent();root.traverse(n=>{if(n.isMesh)n.geometry.dispose();});Object.values(own).forEach(m=>m.dispose());}};
}
