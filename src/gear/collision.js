import * as THREE from 'three';

/** Conservative front/back depth of the actual animated inner garment.
 * This supplements limb capsules for two-sided tabard panels. It is a local
 * projection collider, not general cloth self-collision or continuous CCD. */
export class GarmentDepthCollider {
  constructor(size=96) {
    this.size=size;this.front=new Float32Array(size*size);this.back=new Float32Array(size*size);
    this.minX=-.5;this.maxX=.5;this.minY=.6;this.maxY=1.2;
    this.vertices=[];this.active=false;this.point=new THREE.Vector3();
  }
  update(meshes) {
    this.front.fill(-Infinity);this.back.fill(Infinity);this.active=meshes.length>0;
    const n=this.size,sx=(n-1)/(this.maxX-this.minX),sy=(n-1)/(this.maxY-this.minY);
    for(const mesh of meshes) {
      const g=mesh.geometry,p=g.attributes.position,index=g.index;
      const vertices=this.vertices;
      for(let i=0;i<p.count;i++){
        const v=vertices[i]??(vertices[i]=new THREE.Vector3());v.fromBufferAttribute(p,i);
        if(mesh.isSkinnedMesh)mesh.applyBoneTransform(i,v);
        v.x=(v.x-this.minX)*sx;v.y=(v.y-this.minY)*sy;
      }
      for(let t=0;t<index.count;t+=3){
        const a=vertices[index.getX(t)],b=vertices[index.getX(t+1)],c=vertices[index.getX(t+2)];
        const denominator=(b.y-c.y)*(a.x-c.x)+(c.x-b.x)*(a.y-c.y);
        if(Math.abs(denominator)<1e-8)continue;
        const left=Math.max(0,Math.floor(Math.min(a.x,b.x,c.x))),right=Math.min(n-1,Math.ceil(Math.max(a.x,b.x,c.x)));
        const bottom=Math.max(0,Math.floor(Math.min(a.y,b.y,c.y))),top=Math.min(n-1,Math.ceil(Math.max(a.y,b.y,c.y)));
        for(let y=bottom;y<=top;y++)for(let x=left;x<=right;x++){
          const wa=((b.y-c.y)*(x-c.x)+(c.x-b.x)*(y-c.y))/denominator;
          const wb=((c.y-a.y)*(x-c.x)+(a.x-c.x)*(y-c.y))/denominator,wc=1-wa-wb;
          if(wa<-.001||wb<-.001||wc<-.001)continue;
          const z=wa*a.z+wb*b.z+wc*c.z,i=y*n+x;
          this.front[i]=Math.max(this.front[i],z);this.back[i]=Math.min(this.back[i],z);
        }
      }
    }
  }
  project(point,side,clearance=.009) {
    if(!this.active)return;
    const n=this.size,x=Math.round((point.x-this.minX)/(this.maxX-this.minX)*(n-1)),y=Math.round((point.y-this.minY)/(this.maxY-this.minY)*(n-1));
    if(x<0||x>=n||y<0||y>=n)return;
    if(!Number.isFinite(this.front[y*n+x]))return;
    let limit=side>0?-Infinity:Infinity;
    // Expand a cell around the sample so triangles between cloth particles
    // also clear the inner garment rather than only their corner vertices.
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
      const u=x+dx,v=y+dy;if(u<0||u>=n||v<0||v>=n)continue;
      // The silhouette edge must allow tangential escape. Extending a depth
      // sample outside it would teleport a side seam onto the garment front.
      if(!Number.isFinite(this.front[v*n+u]))return;
      limit=side>0?Math.max(limit,this.front[v*n+u]):Math.min(limit,this.back[v*n+u]);
    }
    if(Number.isFinite(limit))point.z=side>0?Math.max(point.z,limit+clearance):Math.min(point.z,limit-clearance);
  }
}
