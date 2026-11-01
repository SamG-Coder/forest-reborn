import * as THREE from 'three';
import {createArrowGeometry} from '../game/arrow-model.js';
import {arrowPosition} from '../game/archery.js';

/** One instanced draw for airborne arrows, shared by world and battle views. */
export class ArrowVolley {
  constructor(scene,capacity=1024){
    this.mesh=new THREE.InstancedMesh(createArrowGeometry(),new THREE.MeshBasicMaterial({vertexColors:true}),capacity);this.mesh.count=0;this.mesh.frustumCulled=false;scene.add(this.mesh);
    this.capacity=capacity;this.matrix=new THREE.Matrix4();this.rotation=new THREE.Quaternion();this.position=new THREE.Vector3();this.next=new THREE.Vector3();this.scale=new THREE.Vector3(1,1,1);this.forward=new THREE.Vector3(0,0,1);
  }
  update(shots,time,offset={x:0,z:0}){
    let count=0;
    for(const shot of shots){if(time<shot.start||time>shot.end||count>=this.capacity)continue;arrowPosition(shot,time,this.position);arrowPosition(shot,time+.005,this.next);this.rotation.setFromUnitVectors(this.forward,this.next.sub(this.position).normalize());this.position.x+=offset.x??0;this.position.z+=offset.z??0;this.matrix.compose(this.position,this.rotation,this.scale);this.mesh.setMatrixAt(count++,this.matrix);}
    this.mesh.count=count;this.mesh.instanceMatrix.clearUpdateRanges();if(count)this.mesh.instanceMatrix.addUpdateRange(0,count*16);this.mesh.instanceMatrix.needsUpdate=true;
  }
  dispose(){this.mesh.removeFromParent();this.mesh.geometry.dispose();this.mesh.material.dispose();}
}
export class ProjectileEffects extends ArrowVolley {
  constructor(scene){super(scene,256);this.time=0;this.shots=[];}
  add(shot){if(this.shots.length>=this.capacity)return;this.shots.push({...shot,start:this.time,end:this.time+shot.end-shot.start});}
  tick(dt){this.time+=dt;this.shots=this.shots.filter(s=>s.end>=this.time);super.update(this.shots,this.time);}
}
