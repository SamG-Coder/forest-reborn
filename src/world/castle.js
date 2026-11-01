import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {HIGHMERE,HIGHMERE_WALL,HIGHMERE_GATES,regionRoadDistance} from './region-layout.js';
import {terrainHeight} from './terrain.js';
import {loadMaterialSet,metricUV} from './materials.js';
import {createFountain} from './fountain.js';
import {createCastleHall} from './castle-interior.js';

const TAU=Math.PI*2;
const ground=(x,z)=>terrainHeight(HIGHMERE.x+x,HIGHMERE.z+z);

function hipRoof(width,depth,height){
  const w=width/2,d=depth/2,r=w*.55;
  const vertices=[[-w,0,-d],[w,0,-d],[w,0,d],[-w,0,d],[-r,height,0],[r,height,0]];
  const indices=[0,4,5,0,5,1,1,5,2,2,5,4,2,4,3,3,4,0];
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(indices.flatMap(i=>vertices[i]),3));
  geometry.computeVertexNormals();return geometry;
}

/** Terrain-following defensive ring and a separate hilltop keep. All positions are local metres. */
export async function createCastle(parent,worldMaterials){
  const textures=await loadMaterialSet(['castle-limestone','castle-slate','castle-bedrock']);
  const stone=textures['castle-limestone'],slate=textures['castle-slate'],rock=textures['castle-bedrock'];
  const trim=stone.clone();trim.color.set('#e4dfd0');
  const dark=new THREE.MeshToonMaterial({color:'#29373b'});
  const blue=new THREE.MeshToonMaterial({color:'#345e83',side:THREE.DoubleSide});
  const brass=new THREE.MeshToonMaterial({color:'#d4b56e'});
  const root=new THREE.Group();root.name='Highmere hilltop castle';root.position.set(HIGHMERE.x,0,HIGHMERE.z);parent.add(root);
  const batches=new Map(),colliders=[],gateObjects=[];
  function add(geometry,material,x,y,z,angle=0,uvScale=4){
    const g=geometry.index?geometry.toNonIndexed():geometry;
    if(g!==geometry)geometry.dispose();
    g.rotateY(angle);metricUV(g,uvScale);g.translate(x,y,z);
    if(!batches.has(material))batches.set(material,[]);batches.get(material).push(g);
  }
  function solid(x,z,w,d,angle=0){
    const c=Math.abs(Math.cos(angle)),s=Math.abs(Math.sin(angle)),ex=(w*c+d*s)/2,ez=(d*c+w*s)/2;
    colliders.push({minX:HIGHMERE.x+x-ex,maxX:HIGHMERE.x+x+ex,minZ:HIGHMERE.z+z-ez,maxZ:HIGHMERE.z+z+ez});
  }
  function box(mat,x,y,z,w,h,d,angle=0){add(new THREE.BoxGeometry(w,h,d),mat,x,y,z,angle);}
  function foundation(points,top){
    const vertices=[];
    for(let i=0;i<points.length;i++){
      const a=points[i],b=points[(i+1)%points.length],count=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/1.5);
      for(let j=0;j<count;j++){
        const ax=a[0]+(b[0]-a[0])*j/count,az=a[1]+(b[1]-a[1])*j/count,bx=a[0]+(b[0]-a[0])*(j+1)/count,bz=a[1]+(b[1]-a[1])*(j+1)/count;
        const ay=Math.min(top-.2,ground(ax,az)-.6),by=Math.min(top-.2,ground(bx,bz)-.6);
        vertices.push(ax,ay,az,bx,top,bz,ax,top,az,ax,ay,az,bx,by,bz,bx,top,bz);
      }
    }
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.computeVertexNormals();add(g,stone,0,0,0);
  }
  const rectangularFoundation=(x,z,w,d,top)=>foundation([[x-w/2,z-d/2],[x-w/2,z+d/2],[x+w/2,z+d/2],[x+w/2,z-d/2]],top);
  function window(x,y,z,angle=0,w=1.1,h=2.8){
    const shape=new THREE.Shape();shape.moveTo(-w/2,0);shape.lineTo(w/2,0);shape.lineTo(w/2,h-w/2);
    shape.absarc(0,h-w/2,w/2,0,Math.PI,false);shape.closePath();
    add(new THREE.ShapeGeometry(shape,8),dark,x,y,z,angle);
    const dx=Math.sin(angle),dz=Math.cos(angle);
    box(trim,x,y-.08,z,w+.45,.2,.45,angle);
    box(brass,x+dx*.02,y+h*.48,z+dz*.02,.06,h*.88,.06,angle);
  }
  function banner(x,y,z,angle=0){
    box(brass,x,y+2.6,z,.1,5.2,.1);
    const geometry=new THREE.PlaneGeometry(1.55,3,3,4),p=geometry.attributes.position;
    for(let i=0;i<p.count;i++)p.setZ(i,Math.sin(p.getX(i)*2+p.getY(i))*.1);
    geometry.computeVertexNormals();add(geometry,blue,x,y+1.5,z+.12,angle);
    box(brass,x,y+2,z+.2,.1,1.2,.03,angle);
  }
  function tower(x,z,r=4.3,h=13,roof=true,base=ground(x,z)){
    foundation(Array.from({length:32},(_,i)=>[x+Math.sin(i*TAU/32)*(r+.45),z+Math.cos(i*TAU/32)*(r+.45)]),base+.4);
    add(new THREE.CylinderGeometry(r,r+.45,h,24,1),stone,x,base+h/2,z);
    add(new THREE.CylinderGeometry(r+.45,r+.48,.7,24),trim,x,base+.35,z);
    for(const level of [h*.6,h-.65])add(new THREE.CylinderGeometry(r+.3,r+.1,.45,24),trim,x,base+level,z);
    if(roof){
      add(new THREE.ConeGeometry(r+1.0,r*1.65,24),slate,x,base+h+r*.825,z,0,3);
      add(new THREE.SphereGeometry(.25,8,6),brass,x,base+h+r*1.65,z);
    }else{
      add(new THREE.CylinderGeometry(r+.5,r,.8,24),trim,x,base+h-.2,z);
      for(let i=0;i<12;i++){const a=i*TAU/12;box(stone,x+Math.sin(a)*r,base+h+.7,z+Math.cos(a)*r,1.1,1.6,1.15,a);}
    }
    for(let i=0;i<6;i++){const a=i*TAU/6;window(x+Math.sin(a)*(r+.03),base+h*.62,z+Math.cos(a)*(r+.03),a,.7,2.4);}
    solid(x,z,r*1.9,r*1.9);return base;
  }
  function wall(a,b,height=7.2,thickness=2.5){
    const dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz),angle=Math.atan2(dx,dz),count=Math.ceil(length/2.7);
    for(let i=0;i<count;i++){
      const t=(i+.5)/count,x=a[0]+dx*t,z=a[1]+dz*t,segment=length/count;
      // Stepped bases overlap the terrain; nearby pieces share a continuous parapet.
      const y=ground(x,z),rise=Math.abs(ground(x+dx/count/2,z+dz/count/2)-ground(x-dx/count/2,z-dz/count/2));
      box(stone,x,y+(height-rise)/2-.3,z,thickness,height+rise+.6,segment+.05,angle);
      box(trim,x,y+height-.7,z,thickness+.4,.35,segment+.07,angle);
      box(stone,x,y+height+.55,z,thickness+.1,1.1,segment*.55,angle);
      solid(x,z,thickness,segment+.02,angle);
    }
  }
  function gate(index){
    const [x,z]=HIGHMERE_WALL[index],before=HIGHMERE_WALL[(index+HIGHMERE_WALL.length-1)%HIGHMERE_WALL.length],after=HIGHMERE_WALL[(index+1)%HIGHMERE_WALL.length];
    let tx=after[0]-before[0],tz=after[1]-before[1];const length=Math.hypot(tx,tz);tx/=length;tz/=length;
    const angle=Math.atan2(-tz,tx),y=ground(x,z);
    tower(x-tx*11.7,z-tz*11.7,4.9,13,true);tower(x+tx*11.7,z+tz*11.7,4.9,13,true);
    const shape=new THREE.Shape();shape.moveTo(-8.2,0);shape.lineTo(-8.2,13);shape.lineTo(8.2,13);shape.lineTo(8.2,0);shape.lineTo(6.4,0);shape.lineTo(6.4,5.1);shape.absarc(0,5.1,6.4,0,Math.PI,false);shape.lineTo(-6.4,0);shape.closePath();
    const g=new THREE.ExtrudeGeometry(shape,{depth:4.2,bevelEnabled:false,curveSegments:16});g.translate(0,0,-2.1);add(g,stone,x,y,z,angle);
    box(trim,x,y+12.65,z,16.5,.45,4.5,angle);
    for(let i=-3;i<=3;i++)box(stone,x+tx*i*2.4,y+13.7,z+tz*i*2.4,1.25,1.4,4.3,angle);
    banner(x-tx*9,y+8,z-tz*9,angle);banner(x+tx*9,y+8,z+tz*9,angle);
    const panel=new THREE.Group();panel.name='Highmere gate '+index;panel.position.set(x,y,z);panel.rotation.y=angle;root.add(panel);
    const leaf=new THREE.Mesh(metricUV(new THREE.BoxGeometry(12.6,6.7,.45),2),worldMaterials['wall-timber']);leaf.position.y=3.35;leaf.castShadow=true;panel.add(leaf);
    for(const h of [1,3.2,5.6]){const band=new THREE.Mesh(new THREE.BoxGeometry(12.7,.17,.51),dark);band.position.y=h;panel.add(band);}
    for(let bx=-6;bx<=6;bx+=.8){const bar=new THREE.Mesh(new THREE.BoxGeometry(.1,7.3,.12),dark);bar.position.set(bx,3.65,.31);panel.add(bar);}
    const nx=Math.sin(angle),nz=Math.cos(angle),outside=nx*x+nz*z>=0?1:-1;
    const ex=(Math.abs(tx)*12.8+Math.abs(nx)*.7)/2,ez=(Math.abs(tz)*12.8+Math.abs(nz)*.7)/2;
    panel.position.y=y+7.5;
    gateObjects.push({id:'highmere-gate-'+index,position:new THREE.Vector3(HIGHMERE.x+x,y,HIGHMERE.z+z),normal:new THREE.Vector3(nx*outside,0,nz*outside),tangent:new THREE.Vector3(tx,0,tz),panel,base:y,
      collider:{gateId:'highmere-gate-'+index,minX:HIGHMERE.x+x-ex,maxX:HIGHMERE.x+x+ex,minZ:HIGHMERE.z+z-ez,maxZ:HIGHMERE.z+z+ez},
      update(state,dt){panel.visible=state.hp>0;panel.position.y=THREE.MathUtils.damp(panel.position.y,y+(state.closed?0:7.5),3,dt);}});
  }
  const gates=new Set(HIGHMERE_GATES);
  for(let i=0;i<HIGHMERE_WALL.length;i++){
    const j=(i+1)%HIGHMERE_WALL.length,a=HIGHMERE_WALL[i],b=HIGHMERE_WALL[j],len=Math.hypot(b[0]-a[0],b[1]-a[1]);
    const start=gates.has(i)?15/len:0,end=gates.has(j)?1-15/len:1;
    wall([a[0]+(b[0]-a[0])*start,a[1]+(b[1]-a[1])*start],[a[0]+(b[0]-a[0])*end,a[1]+(b[1]-a[1])*end]);
    if(!gates.has(i)&&i%2===1)tower(a[0],a[1],4.2,11.5+i%3,false);
  }
  gates.forEach(gate);

  // The keep occupies the rocky crown, offset from the lower town's market axis.
  const kx=-12,kz=-80,base=ground(kx,kz);
  rectangularFoundation(kx,kz,31.1,24.1,base+.1);
  // Wall shell leaves a real, collision-free entrance into the great hall.
  for(const side of [-1,1]){box(stone,kx+side*15,base+7.6,kz,1,15.2,24);solid(kx+side*15,kz,1,24);}
  box(stone,kx,base+7.6,kz-11.5,31,15.2,1);solid(kx,kz-11.5,31,1);
  for(const side of [-1,1]){box(stone,kx+side*8.75,base+7.6,kz+11.5,13.5,15.2,1);solid(kx+side*8.75,kz+11.5,13.5,1);}
  box(stone,kx,base+10.1,kz+11.5,4,10.2,1);
  for(const side of [-1,1])box(trim,kx+side*8.75,base+.35,kz+12,13.5,.7,1.1);
  box(trim,kx,base+9,kz,31.7,.5,24.7);
  box(trim,kx,base+15.2,kz,32,.6,25);
  add(hipRoof(34,27,8),slate,kx,base+15.4,kz,0,3.5);
  for(const x of [-22,-12,-2])for(const h of [3.8,10.3])if(x!==-12||h>5)window(x,base+h,-67.96,0,1.5,3.3);
  // The portal is open all the way through. Stone jambs frame the opening.
  for(const side of [-1,1])box(trim,kx+side*2.2,base+2.5,kz+12,.4,5,.5);
  box(trim,kx,base+5.12,kz+12,4.8,.32,.5);
  for(const z of [-87,-78])window(3.54,base+10,z,Math.PI/2,1.5,3.3);
  tower(-29,-84,7.0,27,true,base-1);tower(4,-86,4.3,20,true,base-1);
  // Chapel wing and a squat stair turret break up the keep's silhouette.
  box(stone,8,base+5.5,-65,10,11,16);solid(8,-65,10,16);
  rectangularFoundation(8,-65,10.1,16.1,base+.1);
  add(hipRoof(11.4,17.4,5.5),slate,8,base+11,-65,Math.PI/2,3);
  tower(-26,-65,3.1,14,false,base-1);
  window(8,base+4,-56.95,0,2.6,5);
  const hall=createCastleHall(root,{stone,wood:worldMaterials['wall-timber'],base});colliders.push(...hall.colliders);
  for(const x of [-16,-8])banner(x,base+8,-67.6);
  for(let i=0;i<4;i++)box(trim,-12,base-.15-i*.18,-66.8+i*.65,5.4,.35,1.4);
  // A low retaining wall follows the upper terrace, leaving the winding road open.
  for(const [a,b]of [[[-44,-101],[-12,-109]],[[-12,-109],[22,-95]],[[22,-95],[25,-75]],[[-44,-101],[-48,-79]]])wall(a,b,3.2,1.3);
  for(let i=0;i<25;i++){
    const a=i*2.39996,x=-12+Math.sin(a)*(44+(i%3)*6),z=-76+Math.cos(a)*(34+(i%4)*3);
    if(regionRoadDistance(x+HIGHMERE.x,z+HIGHMERE.z)<3)continue;
    const g=new THREE.IcosahedronGeometry(1,1);g.scale(3+i%4,2.5+i%3,3.5+i%3);g.rotateY(a);
    add(g,rock,x,ground(x,z)-1.8,z,0,5);
  }

  // Market stalls and their assigned workers are owned by settlement-details.
  const fy=ground(0,19),fountain=createFountain(root,{stone,trim,x:0,y:fy,z:19});
  foundation(Array.from({length:40},(_,i)=>[Math.sin(i*TAU/40)*3.9,19+Math.cos(i*TAU/40)*3.9]),fy+.1);solid(0,19,7.8,7.8);
  for(const [material,parts]of batches){const geometry=mergeGeometries(parts);parts.forEach(g=>g.dispose());const mesh=new THREE.Mesh(geometry,material);mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);}
  return {root,colliders,gates:gateObjects,interiorLights:hall.fixtures,update:seconds=>{fountain.update(seconds);hall.update(seconds);},dispose(){
    fountain.dispose();hall.dispose();
    root.removeFromParent();root.traverse(node=>{if(node.isMesh)node.geometry.dispose();});
    for(const mat of Object.values(textures)){mat.map.dispose();mat.normalMap.dispose();mat.userData.roughnessMap.dispose();mat.dispose();}
    [trim,dark,blue,brass].forEach(mat=>mat.dispose());
  }};
}
