import * as THREE from 'three';

/** Distance LOD simplification retaining UV islands and four-bone skin weights.
 * It operates on the registered garment geometry, never a substitute outfit. */
export function clusterSkinnedGeometry(source,size){
  if(!size)return source.clone();
  const attributes=source.attributes,p=attributes.position,uv=attributes.uv,n=attributes.normal,groups=new Map(),remap=new Uint32Array(p.count),entries=[];
  for(let i=0;i<p.count;i++){
    const nx=n?.getX(i)??0,ny=n?.getY(i)??0,nz=n?.getZ(i)??0,axis=Math.abs(nx)>Math.abs(ny)&&Math.abs(nx)>Math.abs(nz)?(nx>0?0:1):Math.abs(ny)>Math.abs(nz)?(ny>0?2:3):(nz>0?4:5);
    const key=[Math.round(p.getX(i)/size),Math.round(p.getY(i)/size),Math.round(p.getZ(i)/size),axis,uv?Math.floor(uv.getX(i)*(size>.06?1:4)):0,uv?Math.floor(uv.getY(i)*(size>.06?1:4)):0].join(':');
    let entry=groups.get(key);if(!entry){entry={index:entries.length,vertices:[],weights:new Map()};groups.set(key,entry);entries.push(entry);}entry.vertices.push(i);remap[i]=entry.index;
    if(attributes.skinIndex)for(let k=0;k<4;k++){const bone=attributes.skinIndex.array[i*4+k],w=attributes.skinWeight.array[i*4+k];entry.weights.set(bone,(entry.weights.get(bone)??0)+w);}
  }
  const result=new THREE.BufferGeometry();
  for(const [name,attribute]of Object.entries(attributes)){
    if(name==='skinIndex'||name==='skinWeight')continue;
    const data=new Float32Array(entries.length*attribute.itemSize);
    for(const e of entries)for(let k=0;k<attribute.itemSize;k++){let sum=0;for(const i of e.vertices)sum+=attribute.array[i*attribute.itemSize+k];data[e.index*attribute.itemSize+k]=sum/e.vertices.length;}
    result.setAttribute(name,new THREE.Float32BufferAttribute(data,attribute.itemSize));
  }
  if(attributes.skinIndex){
    const ids=new Uint16Array(entries.length*4),weights=new Float32Array(entries.length*4);
    for(const e of entries){const top=[...e.weights].sort((a,b)=>b[1]-a[1]).slice(0,4),total=top.reduce((s,x)=>s+x[1],0)||1;top.forEach(([bone,w],k)=>{ids[e.index*4+k]=bone;weights[e.index*4+k]=w/total;});}
    result.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(ids,4));result.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));
  }
  const old=source.index?.array??Array.from({length:p.count},(_,i)=>i),indices=[];
  for(let i=0;i<old.length;i+=3){const a=remap[old[i]],b=remap[old[i+1]],c=remap[old[i+2]];if(a!==b&&b!==c&&c!==a)indices.push(a,b,c);}
  result.setIndex(indices);result.normalizeNormals();result.computeBoundingSphere();return result;
}
