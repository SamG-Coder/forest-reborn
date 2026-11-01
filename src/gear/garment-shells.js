import * as THREE from 'three';
import {mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
import {cutGarment} from '../avatar/clothing.js';

/** A connected crotch and enough knee loops to bend while seated or running. */
export function trouserShell(body,{hem=.115,waist=1.075,ease=.013}={}){
  const geometry=cutGarment(body,hem,waist,ease),p=geometry.attributes.position;
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i),sign=x<0?-1:1;
    if(y<.81){
      const centre=sign*.113,dx=x-centre,r=Math.hypot(dx,z),width=.052+.030*THREE.MathUtils.smoothstep(y,.28,.78);
      if(r>1e-5){const loose=Math.max(1,width/r);p.setXYZ(i,centre+dx*loose,y,z*loose);}
    }
  }
  geometry.deleteAttribute('normal');const welded=mergeVertices(geometry,1e-5);geometry.dispose();welded.computeVertexNormals();return welded;
}
