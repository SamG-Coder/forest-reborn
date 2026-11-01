import * as THREE from 'three';

/** Elliptical cross-section loft. Each ring is [y, halfWidth, halfDepth, centerX?, centerZ?]. */
export function loft(rings,segments=16,angleStart=0,angleLength=Math.PI*2){
 const p=[],uv=[],idx=[];
 rings.forEach(([y,rx,rz,cx=0,cz=0],j)=>{
  for(let i=0;i<=segments;i++){const a=angleStart+i/segments*angleLength;p.push(cx+Math.sin(a)*rx,y,cz+Math.cos(a)*rz);uv.push(i/segments,j/(rings.length-1));}
 });
 for(let j=0;j<rings.length-1;j++)for(let i=0;i<segments;i++){const a=j*(segments+1)+i,b=a+segments+1;idx.push(a,a+1,b,b,a+1,b+1);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g;
}
export function ellipsoid(x,y,z,sx,sy,sz){const g=new THREE.SphereGeometry(1,16,12);g.scale(sx,sy,sz);g.translate(x,y,z);return g;}
export function box(x,y,z,sx,sy,sz){return new THREE.BoxGeometry(sx,sy,sz).translate(x,y,z);}
/** Solid curved, tapered hair lock, with UVs along its length. */
export function hairLock(points,width,depth){
 const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));
 const p=[],uv=[],idx=[],segments=8,sides=6;
 const frames=curve.computeFrenetFrames(segments,false);
 for(let j=0;j<=segments;j++){
  const t=j/segments,c=curve.getPoint(t),taper=Math.max(.012,Math.pow(1-t,.65));
  for(let i=0;i<=sides;i++){const a=i/sides*Math.PI*2;const v=c.clone().addScaledVector(frames.normals[j],Math.cos(a)*width*taper).addScaledVector(frames.binormals[j],Math.sin(a)*depth*taper);p.push(v.x,v.y,v.z);uv.push(.42+i/sides*.12,t);}
 }
 for(let j=0;j<segments;j++)for(let i=0;i<sides;i++){const a=j*(sides+1)+i,b=a+sides+1;idx.push(a,a+1,b,b,a+1,b+1);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g;
}
