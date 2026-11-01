import * as THREE from 'three';
import { correctUpperBody } from './proportions.js';

/** Refine only head edges, interpolating the base UVs. Shared marked edges are
 * split on both neighbouring triangles, avoiding cracks at the neck transition. */
export function refineHead(source) {
  let positions=Array.from(source.attributes.position.array), uvs=Array.from(source.attributes.uv.array);
  let faces=source.index?Array.from(source.index.array):Array.from({length:positions.length/3},(_,i)=>i);
  for(let pass=0;pass<3;pass++){
    const marks=new Set(),key=(a,b)=>a<b?`${a}:${b}`:`${b}:${a}`;
    for(let i=0;i<faces.length;i+=3)for(const [a,b] of [[faces[i],faces[i+1]],[faces[i+1],faces[i+2]],[faces[i+2],faces[i]]]){
      if(Math.min(positions[a*3+1],positions[b*3+1])<1.535)continue;
      const d=Math.hypot(...[0,1,2].map(j=>positions[a*3+j]-positions[b*3+j]));
      if(d>.008)marks.add(key(a,b));
    }
    const midpoints=new Map();
    for(const edge of marks){const [a,b]=edge.split(':').map(Number),id=positions.length/3;midpoints.set(edge,id);for(let j=0;j<3;j++)positions.push((positions[a*3+j]+positions[b*3+j])/2);for(let j=0;j<2;j++)uvs.push((uvs[a*2+j]+uvs[b*2+j])/2);}
    const next=[];
    for(let i=0;i<faces.length;i+=3){
      const [a,b,c]=faces.slice(i,i+3),ab=midpoints.get(key(a,b)),bc=midpoints.get(key(b,c)),ca=midpoints.get(key(c,a));
      const n=[ab,bc,ca].filter(v=>v!==undefined).length;
      if(!n)next.push(a,b,c);
      else if(n===3)next.push(a,ab,ca,ab,b,bc,ca,bc,c,ab,bc,ca);
      else if(n===1){if(ab!==undefined)next.push(a,ab,c,ab,b,c);else if(bc!==undefined)next.push(b,bc,a,bc,c,a);else next.push(c,ca,b,ca,a,b);}
      else {if(ab===undefined)next.push(c,ca,bc,ca,a,b,ca,b,bc);else if(bc===undefined)next.push(a,ab,ca,ab,b,c,ab,c,ca);else next.push(b,bc,ab,bc,c,a,bc,a,ab);}
    }
    faces=next;
  }
  const faceCoordinates=[];
  for(let i=0;i<positions.length;i+=3){
    const x=positions[i],y=positions[i+1],z=positions[i+2];
    // Map features to the actual face above the neck, before proportion changes.
    faceCoordinates.push(x/.18+.5,(1.77-y)/.22);
    // Keep the accepted head width. Sculpt the profile in depth, not by
    // squeezing the cheeks. Feature heights follow the dedicated face UV map.
    const blend=THREE.MathUtils.smoothstep(y,1.51,1.60);
    const scale=1-.06*blend;
    const gaussian=(value,center,width)=>Math.exp(-(((value-center)/width)**2));
    const front=THREE.MathUtils.smoothstep(z,-.005,.04);
    const nose=.007*gaussian(x,0,.014)*gaussian(y,1.66,.031)
      +.013*gaussian(x,0,.017)*gaussian(y,1.634,.016);
    const lips=.009*gaussian(x,0,.032)*gaussian(y,1.608,.016);
    const lipCrease=-.001*gaussian(x,0,.026)*gaussian(y,1.600,.005);
    const chin=.005*gaussian(x,0,.039)*gaussian(y,1.588,.017);
    const underJaw=-.010*gaussian(y,1.558,.016)*gaussian(x,0,.06);
    // Neck-only correction below the jaw; zero at cheek and chin heights.
    positions[i]=x*scale;
    positions[i+1]=1.52+(y-1.52)*scale;
    positions[i+2]=(z+front*(nose+lips+lipCrease+chin+underJaw))*scale-.014*blend;
  }
  const geometry=new THREE.BufferGeometry();geometry.setIndex(faces);
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  geometry.setAttribute('faceUv',new THREE.Float32BufferAttribute(faceCoordinates,2));
  correctUpperBody(geometry);
  geometry.computeVertexNormals();
  // Average normals across UV duplicates, so UV boundaries don't become creases.
  const normal=geometry.attributes.normal,groups=new Map();
  const finalPositions=geometry.attributes.position;
  for(let i=0;i<positions.length/3;i++){const key=[finalPositions.getX(i),finalPositions.getY(i),finalPositions.getZ(i)].map(v=>Math.round(v*1e6)).join(':');if(!groups.has(key))groups.set(key,[]);groups.get(key).push(i);}
  for(const ids of groups.values()){const n=new THREE.Vector3();for(const id of ids)n.add(new THREE.Vector3().fromBufferAttribute(normal,id));n.normalize();for(const id of ids)normal.setXYZ(id,n.x,n.y,n.z);}
  return geometry;
}
