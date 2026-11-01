import * as THREE from 'three';

/** Clip triangles at garment hems, interpolating normals instead of keeping
 * whole crossing triangles. Produces straight, reusable waist/leg boundaries. */
export function cutGarment(source, bottom, top, offset = .0025) {
  const pos=source.attributes.position, normal=source.attributes.normal,index=source.index;
  const positions=[],normals=[];
  function clip(polygon,height,above) {
    const result=[];
    for(let i=0;i<polygon.length;i++) {
      const a=polygon[i],b=polygon[(i+1)%polygon.length];
      const ain=above?a.p.y>=height:a.p.y<=height,bin=above?b.p.y>=height:b.p.y<=height;
      if(ain) result.push(a);
      if(ain!==bin) {
        const t=(height-a.p.y)/(b.p.y-a.p.y);
        result.push({p:a.p.clone().lerp(b.p,t),n:a.n.clone().lerp(b.n,t).normalize()});
      }
    }
    return result;
  }
  for(let i=0;i<(index?.count??pos.count);i+=3) {
    let polygon=[0,1,2].map(j=>{const id=index?index.getX(i+j):i+j;return {p:new THREE.Vector3().fromBufferAttribute(pos,id),n:new THREE.Vector3().fromBufferAttribute(normal,id)};});
    polygon=clip(clip(polygon,bottom,true),top,false);
    for(let j=1;j<polygon.length-1;j++)for(const vertex of [polygon[0],polygon[j],polygon[j+1]]){
      // Keep the hem horizontal when offsetting the shell from the skin.
      const p=vertex.p.clone().addScaledVector(vertex.n,offset);
      if(Math.abs(vertex.p.y-bottom)<1e-6)p.y=bottom;
      if(Math.abs(vertex.p.y-top)<1e-6)p.y=top;
      positions.push(...p);normals.push(...vertex.n);
    }
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
  const uv=[];
  for(let i=0;i<positions.length;i+=9){
    const triangle=[];
    for(let j=0;j<3;j++) triangle.push([Math.atan2(positions[i+j*3+2],positions[i+j*3])/(2*Math.PI)+.5,(positions[i+j*3+1]-bottom)/(top-bottom)]);
    if(Math.max(...triangle.map(t=>t[0]))-Math.min(...triangle.map(t=>t[0]))>.5)for(const t of triangle)if(t[0]<.5)t[0]+=1;
    for(const t of triangle)uv.push(...t);
  }
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  return geometry;
}
