import {BoxGeometry,ConeGeometry,Mesh,Quaternion,Vector3} from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {terrainHeight} from './terrain.js';
import {metricUV} from './materials.js';

// Four road openings. Every rail and collider follows the same fence segment.
export const TOWN_FENCES=Object.freeze([
  [-46,-48,-8,-48],[8,-48,46,-48],[-46,42,-6,42],[6,42,46,42],
  [-46,-48,-46,-6],[-46,6,-46,42],[46,-48,46,-6],[46,6,46,42],
  [25,30,42,30],[42,30,42,40],[42,40,25,40],[25,30,25,33],[25,37,25,40],
]);
export function createTownFences(root,material){
  const parts=[],colliders=[];
  for(const [x1,z1,x2,z2]of TOWN_FENCES){
    const count=Math.ceil(Math.hypot(x2-x1,z2-z1)/2.8),posts=[];
    for(let i=0;i<=count;i++){
      const x=x1+(x2-x1)*i/count,z=z1+(z2-z1)*i/count,y=terrainHeight(x,z);posts.push(new Vector3(x,y,z));
      parts.push(new BoxGeometry(.20,1.6,.20).translate(x,y+.8,z));
      parts.push(new ConeGeometry(.15,.22,4).rotateY(Math.PI/4).translate(x,y+1.71,z));
    }
    for(let i=1;i<posts.length;i++){
      const a=posts[i-1],b=posts[i],direction=b.clone().sub(a),q=new Quaternion().setFromUnitVectors(new Vector3(0,1,0),direction.clone().normalize());
      for(const h of [.5,1.12])parts.push(new BoxGeometry(.13,direction.length()+.1,.16).applyQuaternion(q).translate((a.x+b.x)/2,(a.y+b.y)/2+h,(a.z+b.z)/2));
      colliders.push({minX:Math.min(a.x,b.x)-.11,maxX:Math.max(a.x,b.x)+.11,minZ:Math.min(a.z,b.z)-.11,maxZ:Math.max(a.z,b.z)+.11,fence:true});
    }
  }
  parts.forEach(p=>metricUV(p,1.4));const geometry=mergeGeometries(parts);parts.forEach(p=>p.dispose());
  const mesh=new Mesh(geometry,material);mesh.name='terrain-fitted-town-fence';mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);return colliders;
}
