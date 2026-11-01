import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {terrainHeight} from './terrain.js';

/** One broad forked oak is a city landmark; smaller courtyard trees frame it. */
export function createCityTrees(parent,materials,textures){
  const root=new THREE.Group();root.name='Highmere courtyard trees';parent.add(root);const colliders=[],owned=[],crowns=[];
  for(const [index,spec]of [{x:800,z:-829,scale:1.65},{x:909,z:-806,scale:.8},{x:773,z:-879,scale:.7},{x:837,z:-853,scale:.7},{x:869,z:-864,scale:.8},{x:832,z:-794,scale:.66}].entries()){
    const tree=new THREE.Group();tree.position.set(spec.x,terrainHeight(spec.x,spec.z),spec.z);tree.scale.setScalar(spec.scale);root.add(tree);
    const parts=[];
    const branch=(points,radius)=>{
      const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),g=new THREE.TubeGeometry(curve,18,1,9,false),p=g.attributes.position,uv=g.attributes.uv;
      for(let ring=0;ring<=18;ring++){
        const t=ring/18,center=curve.getPointAt(t),r=radius*(1-.90*t);
        for(let side=0;side<=9;side++){const i=ring*10+side;p.setXYZ(i,center.x+(p.getX(i)-center.x)*r,center.y+(p.getY(i)-center.y)*r,center.z+(p.getZ(i)-center.z)*r);uv.setXY(i,side/9*radius*Math.PI,t*curve.getLength()/2);}
      }
      g.computeVertexNormals();parts.push(g);
    };
    branch([[0,-.8,0],[.12,2,0],[-.18,4,.16],[-.9,6.5,0]],.59);
    branch([[0,3,0],[.8,4.6,.1],[2.7,6.7,.7],[4.6,7,.3]],.3);
    branch([[-.1,3.3,0],[-1.3,5,-.3],[-3.1,6,-1.3],[-4.4,7,-.8]],.28);
    branch([[0,3.5,0],[.1,5.4,-1.3],[1.5,7,-3.2]],.24);
    branch([[0,4,.1],[-.7,6,1.8],[-2,7,3.1]],.23);
    for(let i=0;i<6;i++){const a=i*Math.PI/3;branch([[Math.sin(a)*2.2,-.04,Math.cos(a)*2.2],[Math.sin(a)*.85,.12,Math.cos(a)*.85],[0,.7,0]],.13);}
    const geometry=mergeGeometries(parts);parts.forEach(p=>p.dispose());const bark=new THREE.Mesh(geometry,materials.bark);bark.castShadow=bark.receiveShadow=true;tree.add(bark);
    const leaves=new THREE.MeshToonMaterial({map:textures.leaves,color:index===0?'#c2cf83':'#92b57b',alphaTest:.5,side:THREE.DoubleSide});owned.push(leaves);
    const leafGeometry=new THREE.PlaneGeometry(3.4,3.0,4,3),p=leafGeometry.attributes.position;
    for(let i=0;i<p.count;i++)p.setZ(i,.28*(1-p.getX(i)**2/3-p.getY(i)**2/3));leafGeometry.computeVertexNormals();
    const canopy=new THREE.InstancedMesh(leafGeometry,leaves,48),clumps=[];
    for(let i=0;i<48;i++){const angle=i*2.39996,radius=Math.sqrt((i+.5)/48)*4.8;clumps.push({position:new THREE.Vector3(Math.cos(angle)*radius,6.8+Math.sin(i*1.73)*.65+1.8*(1-radius/5),Math.sin(angle)*radius*.82),scale:.8+(i%4)*.14,roll:Math.cos(i)*.26});}
    canopy.instanceMatrix.setUsage(THREE.DynamicDrawUsage);canopy.frustumCulled=false;canopy.castShadow=canopy.receiveShadow=true;tree.add(canopy);crowns.push({canopy,clumps,spec,lastYaw:Infinity,lastPitch:Infinity});
    colliders.push({minX:spec.x-.68*spec.scale,maxX:spec.x+.68*spec.scale,minZ:spec.z-.68*spec.scale,maxZ:spec.z+.68*spec.scale});
  }
  const dummy=new THREE.Object3D();
  function update(camera){
    for(const crown of crowns){
      const {spec,canopy,clumps}=crown,dx=camera.position.x-spec.x,dz=camera.position.z-spec.z;
      const yaw=Math.atan2(dx,dz),pitch=-Math.atan2(camera.position.y-terrainHeight(spec.x,spec.z)-7*spec.scale,Math.hypot(dx,dz));
      if(Math.abs(yaw-crown.lastYaw)<.01&&Math.abs(pitch-crown.lastPitch)<.01)continue;
      crown.lastYaw=yaw;crown.lastPitch=pitch;
      clumps.forEach((clump,i)=>{dummy.position.copy(clump.position);dummy.rotation.set(pitch,yaw,clump.roll,'YXZ');dummy.scale.setScalar(clump.scale);dummy.updateMatrix();canopy.setMatrixAt(i,dummy.matrix);});canopy.instanceMatrix.needsUpdate=true;
    }
  }
  update({position:new THREE.Vector3(850,25,-800)});
  return {root,colliders,update,dispose(){root.removeFromParent();root.traverse(o=>{o.geometry?.dispose();if(o.isInstancedMesh)o.dispose();});owned.forEach(m=>m.dispose());}};
}
