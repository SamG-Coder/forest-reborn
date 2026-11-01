import * as THREE from 'three';

/** Fit to the actual supporting layer. Radial rays are unsuitable here:
 * in a T-pose they cross the arms as well as the collar. */
export function fitSurfacePath(geometry, points, clearance=.004) {
  const position=geometry.attributes.position,index=geometry.index;
  const triangle=new THREE.Triangle(),candidate=new THREE.Vector3(),normal=new THREE.Vector3();
  return points.map(point=>{
    let distance=Infinity;const fitted=point.clone(),outward=new THREE.Vector3();
    for(let i=0;i<index.count;i+=3){
      triangle.a.fromBufferAttribute(position,index.getX(i));
      triangle.b.fromBufferAttribute(position,index.getX(i+1));
      triangle.c.fromBufferAttribute(position,index.getX(i+2));
      triangle.closestPointToPoint(point,candidate);
      triangle.getNormal(normal);
      const radial=candidate.x*normal.x+(candidate.z+.026)*normal.z;
      if(radial<-.0001&&!(candidate.y>1.48&&normal.y>.3))continue;
      const d=candidate.distanceToSquared(point);
      if(d<distance){distance=d;fitted.copy(candidate);outward.copy(normal);}
    }
    return fitted.addScaledVector(outward,clearance);
  });
}
