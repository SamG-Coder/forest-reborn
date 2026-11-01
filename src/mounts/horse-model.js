import * as THREE from 'three';
import {mountDefinition} from './catalog.js';

/** Smooth cross-section loft, with metric longitudinal UVs and closed end caps. */
function loft(sections,segments=18){
  const p=[],uv=[],index=[],centres=sections.map(s=>new THREE.Vector3(...s.slice(0,3)));
  const curve=new THREE.CatmullRomCurve3(centres),rows=(sections.length-1)*4;
  for(let i=0;i<=rows;i++){
    const t=i/rows,c=curve.getPoint(t),forward=curve.getTangent(t),side=new THREE.Vector3(1,0,0);
    side.addScaledVector(forward,-side.dot(forward)).normalize();const up=new THREE.Vector3().crossVectors(forward,side).normalize();
    const at=t*(sections.length-1),a=Math.floor(at),b=Math.min(a+1,sections.length-1),f=at-a;
    const rx=THREE.MathUtils.lerp(sections[a][3],sections[b][3],f),ry=THREE.MathUtils.lerp(sections[a][4],sections[b][4],f);
    for(let j=0;j<=segments;j++){const angle=j/segments*Math.PI*2,v=c.clone().addScaledVector(side,Math.cos(angle)*rx).addScaledVector(up,Math.sin(angle)*ry);p.push(v.x,v.y,v.z);uv.push(j/segments,t);}
  }
  for(let i=0;i<rows;i++)for(let j=0;j<segments;j++){const a=i*(segments+1)+j,b=a+segments+1;index.push(a,a+1,b,a+1,b+1,b);}
  for(const [row,centre]of [[0,centres[0]],[rows,centres.at(-1)]]){const cap=p.length/3;p.push(...centre.toArray());uv.push(.5,.5);for(let j=0;j<segments;j++){const a=row*(segments+1)+j;if(row)index.push(cap,a,a+1);else index.push(cap,a+1,a);}}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(p,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(index);geometry.computeVertexNormals();return geometry;
}
function strand(points,radius){return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),18,radius,6,false);}

/** Reusable horse with four articulated limbs. +Z is forward; hoof level is y=0. */
export function createHorse({id='bay',leatherMap=null}={}){
  const definition=mountDefinition(id),root=new THREE.Group(),body=new THREE.Group();root.name='horse-'+id;root.add(body);
  const ramp=new THREE.DataTexture(new Uint8Array([130,190,232,255]),4,1,THREE.RedFormat);ramp.minFilter=ramp.magFilter=THREE.NearestFilter;ramp.needsUpdate=true;
  const coat=new THREE.MeshToonMaterial({color:definition.coat,gradientMap:ramp}),hair=new THREE.MeshToonMaterial({color:definition.mane,gradientMap:ramp}),muzzle=new THREE.MeshToonMaterial({color:definition.muzzle,gradientMap:ramp}),hoof=new THREE.MeshToonMaterial({color:'#343333'}),eye=new THREE.MeshStandardMaterial({color:'#181b1b',roughness:.22}),ivory=new THREE.MeshToonMaterial({color:'#e5d9bf',gradientMap:ramp});
  const leather=new THREE.MeshToonMaterial({color:'#553d2d',map:leatherMap}),metal=new THREE.MeshStandardMaterial({color:'#ab9770',metalness:.7,roughness:.4}),blanket=new THREE.MeshToonMaterial({color:'#35565d',side:THREE.DoubleSide});
  const materials=[coat,hair,muzzle,hoof,eye,ivory,leather,metal,blanket];
  function add(parent,geometry,material,position=[0,0,0]){const mesh=new THREE.Mesh(geometry,material);mesh.position.set(...position);mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);return mesh;}
  add(body,loft([[0,1.18,-.95,.04,.07],[0,1.22,-.75,.31,.38],[0,1.20,-.42,.37,.38],[0,1.18,0,.39,.38],[0,1.23,.43,.32,.36],[0,1.25,.67,.16,.25],[0,1.29,.71,.04,.09]],24),coat);
  // Broad shoulder blends into an upright tapering neck; the head has a long muzzle.
  add(body,loft([[0,1.15,.40,.26,.30],[0,1.42,.56,.24,.27],[0,1.69,.71,.19,.23],[0,1.91,.93,.14,.17],[0,1.97,1.07,.11,.11]],22),coat);
  const head=new THREE.Group();head.position.set(0,1.96,.98);body.add(head);
  add(head,loft([[0,.07,-.04,.09,.12],[0,.02,.07,.16,.20],[0,-.11,.22,.14,.19],[0,-.24,.39,.10,.13],[0,-.32,.52,.11,.10],[0,-.33,.57,.08,.06]],20),coat);
  add(head,loft([[0,-.30,.44,.105,.10],[0,-.34,.52,.119,.103],[0,-.34,.59,.09,.065]],20),muzzle);
  for(const s of [-1,1]){
    const ear=add(head,loft([[s*.10,.08,0,.055,.04],[s*.13,.22,-.04,.041,.033],[s*.15,.36,-.01,.002,.003]],12),coat);
    add(ear,loft([[0,.11,.012,.026,.009],[s*.025,.23,-.014,.019,.006],[s*.04,.30,0,.001,.001]],10),muzzle,[s*.10,0,0]);
    const eyeball=add(head,new THREE.SphereGeometry(.031,16,10),eye,[s*.145,-.05,.16]);eyeball.scale.set(.48,.8,1);
    add(head,new THREE.SphereGeometry(.006,8,6),ivory,[s*.161,-.039,.177]);
    const nostril=add(head,new THREE.SphereGeometry(.027,12,8),hoof,[s*.094,-.319,.541]);nostril.scale.set(.35,.7,1.1);
    add(head,strand([[s*.15,-.05,.09],[s*.155,-.16,.21],[s*.111,-.29,.45]],.013),leather);
  }
  // Noseband, poll strap and bit connect to the reins, rather than floating props.
  add(head,strand([[-.112,-.27,.43],[0,-.18,.39],[.112,-.27,.43]],.017),leather);
  add(head,strand([[-.15,-.06,.04],[-.10,.13,-.01],[.10,.13,-.01],[.15,-.06,.04]],.014),leather);
  for(const s of [-1,1]){const bit=add(head,new THREE.TorusGeometry(.042,.006,6,16),metal,[s*.118,-.32,.45]);bit.rotation.y=Math.PI/2;}
  if(id==='chestnut')add(head,loft([[0,.09,.13,.027,.003],[0,-.02,.262,.033,.004],[0,-.17,.39,.021,.004],[0,-.27,.48,.018,.003]],8),ivory);
  // Individually tapered mane locks read as a single crest from every angle.
  for(let i=0;i<12;i++){const t=i/11,y=1.47+t*.50,z=.42+t*.48;add(body,loft([[0,y,z,.04,.035],[.015,y+.025,z-.10,.036,.032],[.025,y-.10,z-.15,.002,.002]],10),hair);}
  for(let i=0;i<4;i++)add(head,loft([[(i-1.5)*.034,.14,.09,.031,.018],[(i-1.5)*.04,.05,.24,.025,.015],[(i-1.5)*.033,-.06,.25,.002,.002]],10),hair);
  const tail=new THREE.Group();tail.position.set(0,1.41,-.88);body.add(tail);
  add(tail,loft([[0,0,0,.07,.06],[0,-.20,-.22,.08,.06],[.025,-.48,-.26,.095,.055],[.04,-.85,-.26,.068,.03],[.055,-1.02,-.20,.003,.003]],14),hair);
  const legs=[];
  for(const front of [true,false])for(const s of [-1,1]){
    const upper=new THREE.Group();upper.position.set(s*(front?.255:.275),1.18,front?.48:-.67);body.add(upper);
    add(upper,loft([[0,.12,0,.10,.14],[0,-.12,0,.105,.12],[0,-.33,front?.025:-.08,.070,.075],[0,-.52,0,.045,.055]],14),coat);
    const lower=new THREE.Group();lower.position.set(0,-.52,0);upper.add(lower);
    add(lower,loft([[0,.025,0,.055,.054],[0,-.23,.008,.039,.04],[0,-.43,.01,.045,.05],[0,-.53,.04,.048,.055]],14),id==='chestnut'&&s===1?ivory:coat);
    const foot=new THREE.Group();foot.position.set(0,-.52,.025);lower.add(foot);
    const shoe=add(foot,new THREE.CylinderGeometry(.054,.085,.14,12),hoof,[0,-.065,.025]);shoe.scale.z=1.22;
    legs.push({upper,lower,foot,front,s});
  }
  // Curved blanket and saddle follow the barrel, not flat planes across the back.
  const blanketMesh=add(body,loft([[0,1.2,-.35,.398,.395],[0,1.20,-.05,.406,.405],[0,1.21,.18,.385,.40]],24),blanket);
  // Keep only the upper half of the tube for the saddle cloth.
  const bi=blanketMesh.geometry.index.array,bp=blanketMesh.geometry.attributes.position,kept=[];
  for(let i=0;i<bi.length;i+=3)if((bp.getY(bi[i])+bp.getY(bi[i+1])+bp.getY(bi[i+2]))/3>1.08)kept.push(bi[i],bi[i+1],bi[i+2]);blanketMesh.geometry.setIndex(kept);
  add(body,loft([[0,1.56,-.28,.23,.035],[0,1.57,-.18,.23,.045],[0,1.58,.07,.20,.035],[0,1.61,.19,.22,.055]],20),leather);
  for(const s of [-1,1]){
    add(body,strand([[s*.18,1.57,.06],[s*.39,1.30,.05],[s*.42,.97,.12]],.016),leather);
    const stirrup=add(body,new THREE.TorusGeometry(.085,.011,6,16),metal,[s*.43,.90,.12]);stirrup.scale.y=.75;stirrup.rotation.y=Math.PI/2;
    add(body,strand([[s*.118,1.64,1.43],[s*.22,1.61,.80],[s*.21,1.85,.39]],.008),leather);
  }
  let phase=0,time=0;
  return {root,body,legs,head,tail,definition,seatHeight:1.64,
    update(dt,speed=0){
      time+=dt;const moving=THREE.MathUtils.smoothstep(speed,.03,.6),run=THREE.MathUtils.smoothstep(speed,4,7);
      phase+=speed*dt/THREE.MathUtils.lerp(2.6,4.8,run);const t=phase*Math.PI*2;
      body.position.y=moving*(.012*Math.sin(t*2)+run*.028*Math.cos(t*2));body.rotation.x=moving*run*.025*Math.sin(t);
      for(const [i,leg]of legs.entries()){
        const offset=THREE.MathUtils.lerp([0,.5,.75,.25][i],[0,.12,.55,.43][i],run)*Math.PI*2,a=t+offset;
        leg.upper.rotation.x=Math.sin(a)*THREE.MathUtils.lerp(.38,.70,run)*moving;
        leg.lower.rotation.x=Math.max(0,-Math.cos(a))*(leg.front?-1:1)*THREE.MathUtils.lerp(.50,1.0,run)*moving;
        leg.foot.rotation.x=-leg.upper.rotation.x-leg.lower.rotation.x;
      }
      head.rotation.x=Math.sin(time*1.1)*.018+moving*Math.sin(t)*.015;
      tail.rotation.z=Math.sin(time*1.5)*.065;tail.rotation.x=-run*.12;
    },
    dispose(){root.traverse(o=>o.geometry?.dispose());for(const m of materials)m.dispose();ramp.dispose();root.removeFromParent();},
  };
}
