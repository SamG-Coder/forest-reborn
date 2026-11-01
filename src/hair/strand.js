import * as THREE from 'three';

/** Broad, curved anime hair clump with a rounded ridge and a controlled point. */
export function animeStrand(points,width,depth){
  const curve=new THREE.CatmullRomCurve3(points),p=[],uv=[],index=[],steps=18,sides=8;
  const centre=new THREE.Vector3(0,1.68,-.024);
  for(let row=0;row<=steps;row++){
    const t=row/steps,c=curve.getPoint(t),tangent=curve.getTangent(t).normalize();
    const outward=c.clone().sub(centre).normalize();outward.addScaledVector(tangent,-outward.dot(tangent)).normalize();
    const lateral=new THREE.Vector3().crossVectors(tangent,outward).normalize();
    const taper=Math.max(.006,(.78+.22*Math.sin(t*Math.PI))*(1-t**3));
    for(let col=0;col<=sides;col++){
      const a=col/sides*Math.PI*2,point=c.clone().addScaledVector(lateral,Math.cos(a)*width*taper).addScaledVector(outward,Math.sin(a)*depth*taper);
      p.push(...point);uv.push(col/sides,t);
      if(row&&col){const i=row*(sides+1)+col;index.push(i-sides-2,i-1,i-sides-1,i-sides-1,i-1,i);}
    }
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(index);g.computeVertexNormals();return g;
}
