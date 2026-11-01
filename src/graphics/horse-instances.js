import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {createHorse} from '../mounts/horse-model.js';
import {clusterGeometryAsync} from './geometry-jobs.js';
import {instancedNPCMaterial} from './npc-palette.js';
import {yieldJob} from '../world/async-jobs.js';

/** The same articulated horse as the player's mount, with shared animation
 * matrices. Cavalry does not create hundreds of live Three.js skeletons. */
export async function createHorseInstances(parent,capacity){
  const horse=createHorse(),nodes=[horse.body,horse.head,horse.tail,...horse.legs.flatMap(l=>[l.upper,l.lower,l.foot])];
  horse.root.updateMatrixWorld(true);
  const inverses=nodes.map(n=>n.matrixWorld.clone().invert()),groups=new Map(),width=64,frames=48,data=new Float32Array(width*frames*3*4);
  horse.root.traverse(mesh=>{
    if(!mesh.isMesh)return;
    let node=mesh;while(node&&!nodes.includes(node))node=node.parent;
    const bone=Math.max(0,nodes.indexOf(node)),g=mesh.geometry.clone().applyMatrix4(mesh.matrixWorld),ids=[],weights=[];
    for(let i=0;i<g.attributes.position.count;i++){ids.push(bone,0,0,0);weights.push(1,0,0,0);}
    g.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(ids,4));g.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));
    if(!groups.has(mesh.material))groups.set(mesh.material,[]);groups.get(mesh.material).push(g);
  });
  for(let clip=0;clip<3;clip++)for(let f=0;f<frames;f++){
    if(f%8===0)await yieldJob();
    const speed=clip===0?0:clip===1?3.2:8.4;
    horse.update(speed?(clip===1?2.6:4.8)/speed/frames:1/frames,speed);horse.root.updateMatrixWorld(true);
    nodes.forEach((node,i)=>new THREE.Matrix4().multiplyMatrices(node.matrixWorld,inverses[i]).toArray(data,(clip*frames+f)*width*4+i*16));
  }
  const texture=new THREE.DataTexture(data,width,frames*3,THREE.RGBAFormat,THREE.FloatType);texture.needsUpdate=true;
  const palette={texture,frames},lods=[[],[],[]],batches=[];
  for(const [material,parts]of groups){
    const merged=mergeGeometries(parts);parts.forEach(g=>g.dispose());
    for(let lod=0;lod<3;lod++){
      const geometry=await clusterGeometryAsync(merged,[.025,.09,.22][lod]);
      geometry.setAttribute('npcPose',new THREE.InstancedBufferAttribute(new Float32Array(capacity*4),4).setUsage(THREE.DynamicDrawUsage));
      geometry.setAttribute('npcState',new THREE.InstancedBufferAttribute(new Float32Array(capacity*2),2).setUsage(THREE.DynamicDrawUsage));
      const mesh=new THREE.InstancedMesh(geometry,instancedNPCMaterial(material,palette,{texture}),capacity);
      // Allocate colour before shader warm-up. Creating this on the first
      // visible cavalry frame changes the program variant and stalls rendering.
      mesh.instanceColor=new THREE.InstancedBufferAttribute(new Float32Array(capacity*3).fill(1),3).setUsage(THREE.DynamicDrawUsage);
      mesh.count=0;mesh.frustumCulled=false;mesh.receiveShadow=true;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      parent.add(mesh);lods[lod].push(mesh);batches.push(mesh);
    }
    merged.dispose();
  }
  // Retain the shared gradient texture until all cloned materials are disposed.
  const gradients=new Set([...groups.keys()].map(m=>m.gradientMap).filter(Boolean));
  horse.root.traverse(m=>m.geometry?.dispose());
  for(const material of groups.keys())material.dispose();
  let visible=0,triangles=0;const matrix=new THREE.Matrix4(),q=new THREE.Quaternion(),s=new THREE.Vector3(1,1,1),color=new THREE.Color();
  return {
    begin(){visible=0;triangles=0;for(const mesh of batches)mesh.count=0;},
    add(entity,position,distance,time){
      const speed=entity.speed??0,clip=speed>4?2:speed>.1?1:0,phase=(entity.phase+time*(clip===2?1.75:clip===1?1.23:.4))%1;
      q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP,entity.yaw??0);matrix.compose(position,q,s);
      color.set((entity.index??entity.id)%3===0?'#d0c1b4':(entity.index??entity.id)%3===1?'#ffffff':'#b6a29c');
      for(const mesh of lods[distance<25?0:distance<75?1:2]){
        const i=mesh.count++;mesh.setMatrixAt(i,matrix);mesh.setColorAt(i,color);
        mesh.geometry.attributes.npcPose.setXYZW(i,clip,phase,clip,phase);mesh.geometry.attributes.npcState.setXY(i,1,-1);
        triangles+=(mesh.geometry.index?.count??mesh.geometry.attributes.position.count)/3;
      }
      visible++;
    },
    end(){for(const mesh of batches){mesh.visible=mesh.count>0;if(mesh.count)for(const attribute of [mesh.instanceMatrix,mesh.instanceColor,mesh.geometry.attributes.npcPose,mesh.geometry.attributes.npcState]){attribute.clearUpdateRanges();attribute.addUpdateRange(0,mesh.count*attribute.itemSize);attribute.needsUpdate=true;}}},
    stats:()=>({horses:visible,horseTriangles:triangles}),
    dispose(){for(const mesh of batches){mesh.removeFromParent();mesh.geometry.dispose();mesh.material.dispose();mesh.dispose();}texture.dispose();gradients.forEach(t=>t.dispose());}
  };
}
