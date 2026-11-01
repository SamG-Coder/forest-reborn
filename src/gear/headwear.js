import * as THREE from 'three';

/** Sample the skull itself; the helmet is not an unrelated scaled sphere.
 * An asymmetric rim keeps the brow clear and extends down the rear skull. */
export function createFittedHelmet(headGeometry) {
  const center=new THREE.Vector3(0,1.69,-.024),direction=new THREE.Vector3();
  const material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide});
  const source=new THREE.Mesh(headGeometry,material),ray=new THREE.Raycaster();
  const positions=[],uv=[],indices=[],rimPoints=[],columns=64,rows=22;
  for(let row=0;row<=rows;row++)for(let col=0;col<=columns;col++){
    const phi=col/columns*Math.PI*2,front=Math.sin(phi);
    const limit=1.60-.40*Math.max(0,front)+.35*Math.max(0,-front);
    const theta=limit*row/rows;
    direction.set(Math.sin(theta)*Math.cos(phi),Math.cos(theta),Math.sin(theta)*Math.sin(phi));
    ray.set(center.clone().addScaledVector(direction,.35),direction.clone().negate());
    const hit=ray.intersectObject(source,false).find(hit=>hit.point.y>1.61);
    if(!hit){material.dispose();throw new Error('The male skull could not be sampled for the helmet');}
    const point=hit.point.clone().addScaledVector(direction,.0055);
    positions.push(...point);uv.push(col/columns,row/rows);
    if(row===rows)rimPoints.push(point);
    if(row&&col){const i=row*(columns+1)+col;indices.push(i,i-columns-1,i-1,i-1,i-columns-1,i-columns-2);}
  }
  material.dispose();
  const shell=new THREE.BufferGeometry();shell.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));shell.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));shell.setIndex(indices);shell.computeVertexNormals();
  const rim=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rimPoints.slice(0,-1),true),128,.0035,6,true);
  return {shell,rim};
}

/** Sewn facing from the neckline to the actual neck cross-section. */
export function createCollarFacing(bodyGeometry) {
  const material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide});
  const source=new THREE.Mesh(bodyGeometry,material),ray=new THREE.Raycaster();
  const center=new THREE.Vector3(0,1.533,-.026),p=[],uv=[],indices=[],segments=64;
  for(let col=0;col<=segments;col++){
    const angle=col/segments*Math.PI*2,dir=new THREE.Vector3(Math.cos(angle),0,Math.sin(angle));
    ray.set(center.clone().addScaledVector(dir,.19),dir.clone().negate());
    const hit=ray.intersectObject(source,false).find(hit=>hit.point.distanceTo(center)<.13);
    const inner=hit?hit.point.clone().addScaledVector(dir,-.001):center.clone().addScaledVector(dir,.055);
    const outer=new THREE.Vector3(Math.cos(angle)*.088,1.525,Math.sin(angle)*.075-.026);
    p.push(...outer,...inner);uv.push(col/segments,0,col/segments,1);
    if(col){const i=col*2;indices.push(i-2,i-1,i,i-1,i+1,i);}
  }
  material.dispose();
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(p,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}
