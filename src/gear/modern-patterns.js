import * as THREE from 'three';
import {fitSurfacePath} from './surface-fit.js';
import {trouserShell} from './garment-shells.js';

/** One continuous denim shell preserves the hip/crotch joins during a stride. */
export function jeansShell(body) {
  return trouserShell(body);
}

export function jeanDetails(shell) {
  const paths=[];
  for(const s of [-1,1]){
    paths.push([[s*.065,1.04,.14],[s*.095,.985,.15],[s*.155,.95,.08]]);
    paths.push([[s*.04,.985,-.15],[s*.135,.985,-.13],[s*.143,.9,-.14],[s*.085,.865,-.16],[s*.036,.915,-.16],[s*.04,.985,-.15]]);
    paths.push(Array.from({length:16},(_,i)=>[s*(.16+i/15*.045),.14+i/15*.84,0]));
  }
  paths.push([[.008,1.05,.15],[.012,1,.16],[.010,.94,.155],[.002,.915,.14]]);
  return paths.map(points=>{
    const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));
    const fitted=fitSurfacePath(shell,curve.getPoints(32),.0022);
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(fitted),60,.0012,5,false);
  });
}

export function shirtShell(template){
  const g=template.clone(),p=g.attributes.position;
  for(let i=0;i<p.count;i++){
    const y=p.getY(i),hem=1-THREE.MathUtils.smoothstep(y,1.07,1.2);
    p.setXYZ(i,p.getX(i)*(1+.025*hem),y-hem*.075,p.getZ(i)*(1+.04*hem));
  }
  p.needsUpdate=true;g.computeVertexNormals();return g;
}

export function sneakerSole(sign){
  const shape=new THREE.Shape();
  shape.moveTo(-.047,.092);shape.quadraticCurveTo(-.065,.09,-.063,.025);shape.quadraticCurveTo(-.077,-.035,-.071,-.103);
  shape.quadraticCurveTo(-.06,-.182,0,-.188);shape.quadraticCurveTo(.065,-.183,.072,-.11);shape.quadraticCurveTo(.074,-.02,.061,.028);shape.quadraticCurveTo(.064,.092,.046,.094);shape.closePath();
  const g=new THREE.ExtrudeGeometry(shape,{steps:1,depth:.023,bevelEnabled:true,bevelThickness:.003,bevelSize:.003,bevelSegments:2,curveSegments:10});
  g.rotateX(-Math.PI/2);g.translate(sign*.12,.017,0);return g;
}

export function sneakerUpper(sign){
  const rings=[[-.091,.035,.085],[-.075,.054,.11],[-.04,.060,.121],[0,.064,.112],[.045,.070,.09],[.095,.069,.059],[.14,.055,.032],[.173,.025,.015],[.18,.006,.003]];
  const p=[],uv=[],idx=[],segments=24;
  for(let r=0;r<rings.length;r++)for(let c=0;c<=segments;c++){
    const [z,w,h]=rings[r],a=c/segments*Math.PI;
    p.push(sign*.12+Math.cos(a)*w,.035+Math.sin(a)**.65*h,z);uv.push(c/segments,r/(rings.length-1));
    if(r&&c){const i=r*(segments+1)+c;idx.push(i,i-1,i-segments-1,i-1,i-segments-2,i-segments-1);}
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g;
}

export function sneakerLaces(sign){
  return Array.from({length:5},(_,i)=>{
    const z=-.011+i*.019,y=.158-i*.0075;
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(sign*.12-.031,y-.008,z),new THREE.Vector3(sign*.12,y+.003,z+.007),new THREE.Vector3(sign*.12+.031,y-.008,z)]),12,.0023,6,false);
  });
}
