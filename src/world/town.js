import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {terrainHeight,TOWN_PLOTS} from './terrain.js';
import {metricUV} from './materials.js';
import {createTownFences} from './fences.js';

/** Modular town kit. Colliders are authored alongside each doorway and wall. */
export function createTown(scene,timber,surfaces,herbTexture,{plots=TOWN_PLOTS,name='Mosswake',decorations=true}={}){
  const root=new THREE.Group();root.name=name;scene.add(root);
  const materials={
    plaster:surfaces.plaster,wood:new THREE.MeshToonMaterial({color:'#8a7255',map:timber}),
    dark:new THREE.MeshToonMaterial({color:'#554638',map:timber}),roof:surfaces.roof,
    stone:surfaces.masonry,brick:surfaces['wall-brick'],siding:surfaces['wall-timber'],clay:surfaces['roof-clay'],glass:new THREE.MeshToonMaterial({color:'#536d70'}),
    herb:new THREE.MeshToonMaterial({map:herbTexture,alphaTest:.55,side:THREE.DoubleSide}),
    cloth:new THREE.MeshToonMaterial({color:'#a45243',side:THREE.DoubleSide}),brass:new THREE.MeshToonMaterial({color:'#c7a665'}),
    iron:new THREE.MeshStandardMaterial({color:'#535d60',roughness:.8,metalness:.5}),leaf:new THREE.MeshToonMaterial({color:'#648557'}),fruit:new THREE.MeshToonMaterial({color:'#b96b49'}),
  };
  for(let i=0;i<4;i++){
    materials['plaster'+i]=surfaces.plaster.clone();materials['plaster'+i].color.set(['#f3e6d0','#d1ddd4','#ddc391','#dfc7b7'][i]);
    materials['roof'+i]=surfaces.roof.clone();materials['roof'+i].color.set(['#c1d1d8','#a3baaa','#b5a6a1','#a2b8c5'][i]);
  }
  const batches=new Map(),colliders=[],roofParts=[],interiorLights=[];
  let baseY=0,activePlot=null;
  function transformPoint(x,z){const angle=activePlot?.angle??0,c=Math.cos(angle),s=Math.sin(angle),px=activePlot?.x??0,pz=activePlot?.z??0;return [px+(x-px)*c+(z-pz)*s,pz-(x-px)*s+(z-pz)*c];}
  function transformGeometry(g){if(activePlot?.angle)g.translate(-activePlot.x,0,-activePlot.z).rotateY(activePlot.angle).translate(activePlot.x,0,activePlot.z);}
  function add(geometry,kind,position,rotation=[0,0,0],roof=false){
    if(kind!=='herb')metricUV(geometry,kind==='roof'?2.8:2);
    geometry.applyQuaternion(new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)));geometry.translate(position[0],position[1]+baseY,position[2]);
    transformGeometry(geometry);
    if(activePlot){
      if(kind==='plaster')kind=activePlot.wallMaterial??('plaster'+(activePlot.tint??0));
      if(kind==='roof')kind=activePlot.roofMaterial??('roof'+(activePlot.tint??0));
    }
    const key=kind+(roof?':'+activePlot.id:'');if(!batches.has(key))batches.set(key,[]);batches.get(key).push(geometry);
  }
  function box(kind,x,y,z,w,h,d,roof=false){add(new THREE.BoxGeometry(w,h,d),kind,[x,y,z],[0,0,0],roof);}
  function solid(x,z,w,d){
    // Short wall sections preserve rotated door openings in the AABB nav grid.
    // One box around a whole diagonal wall used to extend across the doorway.
    const count=activePlot?.angle?Math.ceil(Math.max(w,d)/.75):1;
    for(let i=0;i<count;i++){
      const ww=w>=d?w/count:w,dd=d>w?d/count:d;
      const xx=x+(w>=d?((i+.5)/count-.5)*w:0),zz=z+(d>w?((i+.5)/count-.5)*d:0);
      const points=[[-1,-1],[-1,1],[1,-1],[1,1]].map(([sx,sz])=>transformPoint(xx+sx*ww/2,zz+sz*dd/2));
      colliders.push({minX:Math.min(...points.map(p=>p[0])),maxX:Math.max(...points.map(p=>p[0])),minZ:Math.min(...points.map(p=>p[1])),maxZ:Math.max(...points.map(p=>p[1]))});
    }
  }
  function beam(a,b,width=.17,kind='dark',roof=false){
    const from=new THREE.Vector3(...a),to=new THREE.Vector3(...b),delta=to.clone().sub(from),g=new THREE.BoxGeometry(width,delta.length(),width);
    metricUV(g);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize()));const middle=from.add(to).multiplyScalar(.5);g.translate(middle.x,middle.y+baseY,middle.z);
    transformGeometry(g);
    const key=kind+(roof?':'+activePlot.id:'');if(!batches.has(key))batches.set(key,[]);batches.get(key).push(g);
  }
  function sign(text,x,y,z,width=2){
    const canvas=document.createElement('canvas');canvas.width=512;canvas.height=160;
    const ctx=canvas.getContext('2d');ctx.fillStyle='#493c2c';ctx.fillRect(0,0,512,160);ctx.strokeStyle='#d4ba83';ctx.lineWidth=8;ctx.strokeRect(8,8,496,144);
    ctx.font='bold 55px Georgia';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#f4e2b9';ctx.fillText(text,256,84,470);
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
    const m=new THREE.Mesh(new THREE.PlaneGeometry(width,width*160/512),new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide}));const [px,pz]=transformPoint(x,z);m.position.set(px,y+baseY,pz);m.rotation.y=activePlot?.angle??0;root.add(m);
  }
  function barrel(x,z){
    add(new THREE.CylinderGeometry(.37,.34,.85,12,2),'wood',[x,.425,z]);
    for(const y of [.15,.68])add(new THREE.TorusGeometry(.375,.025,5,12),'dark',[x,y,z],[Math.PI/2,0,0]);
    solid(x,z,.75,.75);
  }
  function house({id,x,z,w,d,h=3.6,tavern=false,workshop=false,name,lean=false}){
    baseY=terrainHeight(x,z);
    const usable=tavern||workshop||id.includes('home')||id.startsWith('cottage')||id==='watch';
    const front=z+d/2,back=z-d/2,door=2.4;
    box('stone',x,usable?-.12:.12,z,w+.4,.24,d+.4);
    if(workshop)box('wood',x,.006,z,w-.25,.01,d-.25);
    for(const side of [-1,1]){box('plaster',x+side*w/2,h/2,z,.22,h,d);solid(x+side*w/2,z,.35,d);}
    box('plaster',x,h/2,back,w,h,.22);solid(x,back,w,.35);
    for(const side of [-1,1]){const bx=x+side*(w+door)/4,bw=(w-door)/2;box('plaster',bx,h/2,front,bw,h,.22);solid(bx,front,bw,.35);}
    box('plaster',x,h-.3,front,door,.6,.22);
    if(!usable){box('wood',x,1.35,front-.02,door,2.7,.12);solid(x,front,door,.2);box('plaster',x,(2.7+h)/2,front,door,h-2.7,.23);}
    else{
      // The opening ends at the same height as its frame. Previously the
      // entire strip up to the eaves was missing above an enterable door.
      box('plaster',x,(2.7+h)/2,front,door,h-2.7,.23);
      for(const side of [-1,1])box('dark',x+side*(door/2+.04),1.35,front,.12,2.7,.28);
      box('dark',x,2.72,front,door+.24,.14,.28);
    }
    for(const xx of [x-w/2,x,x+w/2])for(const zz of [front+.14,back-.14]){
      if(xx!==x||zz===back-.14)box('dark',xx,h/2,zz,.19,h,.19);
    }
    for(const yy of [.35,h-.08]){if(usable&&yy===.35){for(const side of [-1,1])box('dark',x+side*(w+door)/4,yy,front+.15,(w-door)/2,.18,.18);}else box('dark',x,yy,front+.15,w+.3,.18,.18);box('dark',x,yy,back-.15,w+.3,.18,.18);}
    for(const xx of [x-w*.3,x+w*.3]){
      box('dark',xx,1.85,front+.16,1.65,1.75,.15);box('glass',xx,1.85,front+.25,1.35,1.45,.08);
      box('wood',xx,1.85,front+.31,.07,1.45,.08);box('wood',xx,1.85,front+.31,1.35,.07,.08);
      box('wood',xx,1.0,front+.4,1.8,.16,.45);
      beam([xx-.8,.5,front+.16],[xx+.8,h-.2,front+.16],.12);
    }
    const rise=w*.27,half=w/2+.6,length=Math.hypot(half,rise),angle=Math.atan2(rise,half);
    for(const side of [-1,1]){
      add(new THREE.BoxGeometry(length,.20,d+1.2),'roof',[x+side*half/2,h+rise/2,z],[0,0,-side*angle],usable);
      for(let row=0;row<7;row++){
        const t=(row+.5)/7;beam([x+side*half*t,h+rise*(1-t)+.13,z-d/2-.6],[x+side*half*t,h+rise*(1-t)+.13,z+d/2+.6],.07,'dark',usable);
      }
      beam([x,h+rise+.1,front+.6],[x+side*half,h,front+.6],.19,'dark',usable);
    }
    beam([x,h+rise+.12,back-.7],[x,h+rise+.12,front+.7],.23,'dark',usable);
    for(const zz of [front,back]){
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute([-w/2,0,0,w/2,0,0,0,rise,0],3));g.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,1,0,.5,1],2));g.setIndex(zz===front?[0,1,2]:[2,1,0]);g.computeVertexNormals();add(g,'plaster',[x,h,zz]);
    }
    box('stone',x+w*.29,h+rise*.55,back+d*.25,.85,rise+1.8,.85,usable);
    if(name)sign(name,x,h-.2,front+.32,tavern?3.6:2.4);
    barrel(x-w/2-.7,front-.7);barrel(x-w/2-.7,front-1.6);
    // Covered entrances, shutters and window boxes provide human-scale detail.
    for(const side of [-1,1]){
      const xx=x+side*w*.3;
      for(const s of [-1,1])box('wood',xx+s*.97,1.85,front+.21,.38,1.5,.1);
      if(id==='apothecary'||tavern){box('wood',xx,.92,front+.55,1.7,.3,.45);for(let i=0;i<7;i++)add(new THREE.PlaneGeometry(.38,.45),'herb',[xx-.64+i*.21,1.28,front+.55]);}
    }
    const porch=tavern?5:3.4;
    add(new THREE.BoxGeometry(porch,.13,2.1),'roof',[x,2.9,front+1.0],[.12,0,0]);
    for(const side of [-1,1])box('dark',x+side*(porch/2-.12),1.4,front+1.9,.16,2.8,.16);
    if(id==='watch'||id==='stores'){
      box('dark',x,h+.8,front+.06,1.5,1.4,.12);box('glass',x,h+.8,front+.14,1.2,1.1,.08);
      box('wood',x,h+.8,front+.21,.08,1.1,.08);box('wood',x,h+.8,front+.21,1.2,.08,.08);
    }
    if(lean){
      box('plaster',x-w/2-1.05,1.1,z+1,2.1,2.2,d*.65);solid(x-w/2-1.05,z+1,2.1,d*.65);
      add(new THREE.BoxGeometry(2.6,.15,d*.65+.65),'roof',[x-w/2-1.05,2.35,z+1],[0,0,.16]);
    }
    if(id.startsWith('cottage')){
      for(const side of [-1,1]){
        beam([x+side*(w/2+.6),.55,front+.5],[x+side*(w/2+.6),.55,front+3.8],.10,'wood');
        for(let i=0;i<4;i++)box('wood',x+side*(w/2+.6),.4,front+.5+i, .08,.8,.08);
      }
      for(let i=0;i<5;i++)add(new THREE.IcosahedronGeometry(.24,1),'leaf',[x-w/2+.4+i*.5,.22,front+.8]);
    }
  }
  for(const plot of plots){activePlot=plot;house(plot);}activePlot=null;
  if(decorations){
  baseY=terrainHeight(-19,-19);
  // Tavern interior: room to walk around the tables and reach the counter.
  box('wood',-19,.006,-19,15.6,.01,12.6);box('wood',-19,.60,-23,10,1.2,.8);solid(-19,-23,10,.9);
  for(let i=0;i<7;i++)box('wood',-24+i*1.55,2.2,-25.2,1.3,.15,.45);
  for(const x of [-23,-15])for(const z of [-16,-20]){
    add(new THREE.CylinderGeometry(1.1,1.1,.12,16),'wood',[x,.82,z]);box('dark',x,.4,z,.17,.8,.17);solid(x,z,1.6,1.6);
    for(const s of [-1,1]){
      box('wood',x+s*1.65,.45,z,.75,.12,.85);
      box('dark',x+s*1.98,.82,z,.1,.82,.85);
      for(const dz of [-.3,.3])box('dark',x+s*1.65,.22,z+dz,.08,.44,.08);
    }
    add(new THREE.CylinderGeometry(.07,.08,.16,8),'brass',[x+.35,.96,z]);add(new THREE.CylinderGeometry(.07,.08,.16,8),'brass',[x-.25,.96,z+.25]);
  }
  interiorLights.push({position:new THREE.Vector3(-26,baseY+1.4,-23.8),alwaysOn:true,power:5,range:8});
  // Market canopies, crates and a well make the square readable at player height.
  for(const [x,z] of [[11,2],[-10,3]]){
    baseY=terrainHeight(x,z);
    box('wood',x,.45,z,4,.9,1.5);solid(x,z,4,1.5);
    for(const s of [-1,1])box('dark',x+s*2,1.6,z,.12,3.2,.12);
    add(new THREE.BoxGeometry(4.6,.07,2.7),'cloth',[x,3,z],[.12,0,0]);
    for(let i=0;i<5;i++){box('dark',x-1.3+i*.6,1.02,z,.5,.24,.65);for(let j=0;j<3;j++)add(new THREE.IcosahedronGeometry(.12,1),i%2?'fruit':'leaf',[x-1.4+i*.6+j*.1,1.18,z+(j%2)*.2]);}
  }
  baseY=terrainHeight(0,-12);
  add(new THREE.CylinderGeometry(1.4,1.5,.9,16,1,true),'stone',[0,.45,-12]);solid(0,-12,2.8,2.8);
  for(const x of [-1.2,1.2])box('wood',x,1.8,-12,.16,3.6,.16);box('wood',0,3.45,-12,3.2,.18,.18);
  // Northern gate and patrol boundary, with open walking routes.
  baseY=terrainHeight(0,-45);
  for(const x of [-7,7]){box('stone',x,1.6,-45,2.2,3.2,2.2);box('wood',x,3.4,-45,2.6,.35,2.6);solid(x,-45,2.2,2.2);}
  colliders.push(...createTownFences(root,materials.wood));
  sign('MOSSWAKE',0,3.9,-44.9,3.4);beam([-7,4.4,-45],[7,4.4,-45],.25,'wood');
  // An open smith's yard and herb bench are real work destinations.
  baseY=terrainHeight(23,24);
  for(const x of [19,28])box('dark',x,1.7,26,.17,3.4,.17);
  add(new THREE.BoxGeometry(10,.12,4.8),'roof',[23.5,3.4,24.3],[-.12,0,0]);
  baseY=terrainHeight(-22,23);
  box('wood',-22,.83,23,3,.12,1);solid(-22,23,3,1);
  for(const x of [-23.3,-20.7])box('wood',x,.4,23,.12,.8,.75);
  for(let i=0;i<7;i++){add(new THREE.CylinderGeometry(.13,.09,.2,8),'cloth',[-23+i*.33,.98,23]);add(new THREE.PlaneGeometry(.4,.45),'herb',[-23+i*.33,1.27,23]);}
  }
  for(const [key,parts] of batches){const [kind,plotId]=key.split(':'),g=mergeGeometries(parts);parts.forEach(p=>p.dispose());const mesh=new THREE.Mesh(g,materials[kind]);mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);if(plotId)roofParts.push({mesh,plot:plots.find(p=>p.id===plotId)});}
  return {root,colliders,interiorLights,
    update(position){for(const {mesh,plot} of roofParts){const dx=position.x-plot.x,dz=position.z-plot.z,a=plot.angle??0,x=dx*Math.cos(a)-dz*Math.sin(a),z=dx*Math.sin(a)+dz*Math.cos(a);mesh.visible=!(Math.abs(x)<plot.w/2&&Math.abs(z)<plot.d/2);}},
    tavern:{minX:-27,maxX:-11,minZ:-25.5,maxZ:-12.5},
    dispose(){root.removeFromParent();root.traverse(node=>{if(node.isMesh){node.geometry.dispose();if(!Object.values(materials).includes(node.material)){node.material.map?.dispose();node.material.dispose();}}});for(const material of new Set(Object.values(materials)))if(!Object.values(surfaces).includes(material))material.dispose();},
  };
}
