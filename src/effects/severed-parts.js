import * as THREE from 'three';
import {BODY_PARTS} from '../game/hit-impact.js';

const rest=new THREE.Vector3(),vertex=new THREE.Vector3(),normal=new THREE.Vector3(),matrix=new THREE.Matrix4(),skin=new THREE.Matrix4();
function distance(v,part){
  if(part==='head')return v.y-1.55;
  if(part.startsWith('arm'))return (part==='armL'?v.x:-v.x)-.31;
  return Math.min(.78-v.y,part==='legL'?v.x:-v.x);
}
function blend(a,b,t){return {rest:a.rest.clone().lerp(b.rest,t),point:a.point.clone().lerp(b.point,t),normal:a.normal.clone().lerp(b.normal,t).normalize(),uv:a.uv.clone().lerp(b.uv,t),face:a.face.clone().lerp(b.face,t)};}
function clippedTriangle(vertices,part){
  const out=[];
  for(let i=0;i<3;i++){const a=vertices[i],b=vertices[(i+1)%3],da=distance(a.rest,part),db=distance(b.rest,part);if(da>=0)out.push(a);if((da<0)!==(db<0))out.push(blend(a,b,da/(da-db)));}
  return out;
}

/** Remove the same bind-pose region at every LOD, including clothes and armor. */
export function severShader(material,{instanced=false,state=null}={}){
  if(!instanced)material.fragmentBase??={compile:material.onBeforeCompile.bind(material),key:material.customProgramCacheKey()};
  const compile=material.onBeforeCompile.bind(material),key=material.customProgramCacheKey();
  material.onBeforeCompile=shader=>{
    compile(shader);if(!instanced)shader.uniforms.severPart=state;
    shader.vertexShader=shader.vertexShader.replace('#include <common>',`#include <common>\nvarying vec3 severRest; varying float severCode; ${instanced?'attribute float npcSever;':'uniform float severPart;'}`);
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>\nseverRest=position;severCode=${instanced?'npcSever':'severPart'};`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 severRest; varying float severCode;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>',`#include <clipping_planes_fragment>
      if((severCode>.5&&severCode<1.5&&severRest.y>1.55)||(severCode>1.5&&severCode<2.5&&severRest.x>.31)||(severCode>2.5&&severCode<3.5&&severRest.x<-.31)||(severCode>3.5&&severCode<4.5&&severRest.y<.78&&severRest.x>0.)||(severCode>4.5&&severRest.y<.78&&severRest.x<0.))discard;`);
  };material.customProgramCacheKey=()=>key+'|sever-'+instanced;material.needsUpdate=true;
}

/** Bounded physical fragments, extracted from the actual posed outfit. */
export class SeveredParts {
  constructor(scene,height){this.scene=scene;this.height=height;this.records=new Map();this.material=new THREE.MeshStandardMaterial({color:'#672321',roughness:.94,side:THREE.DoubleSide});}
  spawn(id,part,sources,matrices,transform,impact={x:0,z:1}){
    if(this.records.has(id)||this.records.size>=48)return;
    const group=new THREE.Group(),bounds=new THREE.Box3(),points=[];
    for(const source of sources){
      const g=source.geometry,p=g.attributes.position,uv=g.attributes.uv,n=g.attributes.normal,ids=g.attributes.skinIndex,w=g.attributes.skinWeight,positions=[],normals=[],uvs=[],faces=[],rests=[];
      const count=g.index?.count??p.count;
      for(let i=0;i<count;i+=3){
        const indices=[0,1,2].map(j=>g.index?g.index.getX(i+j):i+j);
        if(indices.every(k=>distance(rest.fromBufferAttribute(p,k),part)<0))continue;
        const triangle=[];
        for(let j=0;j<3;j++){
          const k=g.index?g.index.getX(i+j):i+j;rest.fromBufferAttribute(p,k);skin.elements.fill(0);
          for(let s=0;s<4;s++){matrix.fromArray(matrices,ids.getComponent(k,s)*16);const weight=w.getComponent(k,s);for(let e=0;e<16;e++)skin.elements[e]+=matrix.elements[e]*weight;}
          vertex.copy(rest).applyMatrix4(skin).applyMatrix4(transform);normal.fromBufferAttribute(n,k).transformDirection(skin).transformDirection(transform);
          triangle.push({rest:rest.clone(),point:vertex.clone(),normal:normal.clone(),uv:uv?new THREE.Vector2().fromBufferAttribute(uv,k):new THREE.Vector2(),face:g.attributes.faceUv?new THREE.Vector2().fromBufferAttribute(g.attributes.faceUv,k):new THREE.Vector2(-1,-1)});
        }
        const poly=clippedTriangle(triangle,part);
        for(let t=1;t<poly.length-1;t++)for(const v of [poly[0],poly[t],poly[t+1]]){positions.push(...v.point);normals.push(...v.normal);uvs.push(...v.uv);faces.push(...v.face);rests.push(...v.rest);bounds.expandByPoint(v.point);if(Math.abs(distance(v.rest,part))<.0001)points.push(v.point.clone());}
      }
      if(!positions.length)continue;
      const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
      geometry.setAttribute('faceUv',new THREE.Float32BufferAttribute(faces,2));geometry.setAttribute('fragmentRest',new THREE.Float32BufferAttribute(rests,3));
      const material=source.material.clone(),base=source.material.fragmentBase??{compile:source.material.onBeforeCompile.bind(source.material),key:source.material.customProgramCacheKey()};
      material.onBeforeCompile=shader=>{base.compile(shader);shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute vec3 fragmentRest;').replace('smoothstep(0.0,.025,position.z)','smoothstep(0.0,.025,fragmentRest.z)');};material.customProgramCacheKey=()=>base.key+'|severed-piece';
      group.add(new THREE.Mesh(geometry,material));
    }
    if(bounds.isEmpty())return;
    const center=bounds.getCenter(new THREE.Vector3());for(const mesh of group.children)mesh.geometry.translate(-center.x,-center.y,-center.z);
    const ring=[...new Map(points.map(p=>[p.toArray().map(n=>n.toFixed(5)).join(','),p])).values()];
    if(ring.length>=3){
      const capCenter=ring.reduce((v,p)=>v.add(p),new THREE.Vector3()).divideScalar(ring.length),axis=ring[0].clone().sub(capCenter).normalize();
      const capNormal=new THREE.Vector3();for(const point of ring){capNormal.copy(point).sub(capCenter).cross(axis);if(capNormal.lengthSq()>1e-10)break;}capNormal.normalize();const tangent=capNormal.clone().cross(axis).normalize();
      ring.sort((a,b)=>Math.atan2(a.clone().sub(capCenter).dot(tangent),a.clone().sub(capCenter).dot(axis))-Math.atan2(b.clone().sub(capCenter).dot(tangent),b.clone().sub(capCenter).dot(axis)));
      const p=[];for(let i=0;i<ring.length;i++)for(const v of [capCenter,ring[i],ring[(i+1)%ring.length]])p.push(...v.clone().sub(center));
      const cap=new THREE.BufferGeometry();cap.setAttribute('position',new THREE.Float32BufferAttribute(p,3));cap.computeVertexNormals();group.add(new THREE.Mesh(cap,this.material));
    }
    group.position.copy(center);this.scene.add(group);
    const stump=new THREE.Mesh(new THREE.CircleGeometry(BODY_PARTS[part].radius,14),this.material);stump.matrixAutoUpdate=false;this.scene.add(stump);
    this.records.set(id,{group,stump,part,age:0,velocity:new THREE.Vector3(impact.x*2.2,2,impact.z*2.2),spin:new THREE.Vector3(1.3,2.1,-.8),radius:part==='head'?.11:.14});
  }
  updateStump(id,matrices,rig,transform){const r=this.records.get(id);if(!r)return;const part=BODY_PARTS[r.part],index=rig.segments.find(s=>s.name===part.bone).index;
    const local=new THREE.Matrix4().compose(new THREE.Vector3(...part.point),new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1),new THREE.Vector3(...part.normal)),new THREE.Vector3(1,1,1));
    r.stump.matrix.copy(transform).multiply(new THREE.Matrix4().fromArray(matrices,index*16)).multiply(local);r.stump.matrixWorldNeedsUpdate=true;
  }
  update(dt){for(const [id,r]of this.records){r.age+=dt;if(r.age>25){this.remove(id);continue;}if(r.age>4.5)continue;const step=Math.min(.05,dt);r.velocity.y-=9.81*step;r.group.position.addScaledVector(r.velocity,step);r.group.rotateX(r.spin.x*step);r.group.rotateZ(r.spin.z*step);const floor=this.height(r.group.position.x,r.group.position.z)+r.radius;if(r.group.position.y<floor){r.group.position.y=floor;r.velocity.y=Math.abs(r.velocity.y)*.18;r.velocity.x*=.65;r.velocity.z*=.65;r.spin.multiplyScalar(.65);}}}
  remove(id){const r=this.records.get(id);if(!r)return;r.group.removeFromParent();r.stump.removeFromParent();r.stump.geometry.dispose();r.group.traverse(o=>{if(o.isMesh){o.geometry.dispose();if(o.material!==this.material)o.material.dispose();}});this.records.delete(id);}
  dispose(){for(const id of this.records.keys())this.remove(id);this.material.dispose();}
}
