import {createHorseInstances} from './horse-instances.js';
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {createHumanoid} from '../npc/humanoid.js';
import {createHairSystem} from '../hair/system.js';
import {weaponAction,isWeapon} from '../game/weapon-catalog.js';
import {clusterGeometryAsync} from './geometry-jobs.js';
import {createNPCPaletteAsync,instancedNPCMaterial,paletteBase} from './npc-palette.js';
import {yieldJob} from '../world/async-jobs.js';
import {bloodShader} from '../effects/blood.js';
import {RagdollAtlas} from '../npc/ragdoll.js';
import {SeveredParts,severShader} from '../effects/severed-parts.js';
import {BODY_PARTS} from '../game/hit-impact.js';
import {warmMeshes} from './warm-meshes.js';

export const NPC_LOD_DISTANCES=Object.freeze([18,45,100,850]);
export function npcLOD(distance,previous=-1){
  if(previous===0&&distance<21)return 0;if(previous===1&&distance>=16&&distance<48)return 1;if(previous===2&&distance>=42&&distance<108)return 2;if(previous===3&&distance>=92)return 3;
  return distance<18?0:distance<45?1:distance<100?2:3;
}

/** Render the same NPC records at three geometry densities. All LODs are built
 * from their real equipped gear with its UVs, coverage masks and skin weights. */
export async function createNPCInstances({scene,entities,profiles,template,registry,materials,height=()=>0,blood=null,onProgress=()=>{},renderer,camera}){
  const root=new THREE.Group();root.name='NPC distance LODs';root.visible=false;scene.add(root);
  const palette=await createNPCPaletteAsync(),ragdolls=new RagdollAtlas(palette.width,entities.length),sets=new Map(),allBatches=[],states=new Map();
  const horses=entities.some(e=>e.mounted)?await createHorseInstances(root,entities.filter(e=>e.mounted).length):null;
  const fragments=new SeveredParts(scene,height),fragmentSources=new Map();
  let compiled=0;
  for(const profile of profiles){
    const source=await createHumanoid(template,registry,materials,{kind:profile.kind??'human',outfit:profile.equipped,skin:profile.skin,face:profile.face??0,bodyType:profile.bodyType??'male'});
    const hair=await createHairSystem(source.avatar,template.gearTemplates.helmet);hair.setStyle(profile.hair??'short');hair.setColor(profile.hairColor??'#392b26');hair.setHeadwear(source.wardrobe.entries.get('head')?.definition);
    source.weapon.setWeapon(profile.weapon);source.weapon.sword.visible=isWeapon(profile.weapon);source.avatar.rig.skeleton.pose();source.root.updateMatrixWorld(true);
    const groups=new Map();
    source.root.traverseVisible(mesh=>{
      if(!mesh.isMesh||!mesh.geometry.attributes.position||Array.isArray(mesh.material))return;
      const geometry=mesh.geometry.clone();
      if(!geometry.attributes.skinIndex){
        geometry.applyMatrix4(mesh.matrixWorld);let parent=mesh,bindBone='handR';while(parent){if(parent.userData.bindBone)bindBone=parent.userData.bindBone;parent=parent.parent;}const bone=source.avatar.rig.segments.find(s=>s.name===bindBone).index,ids=[],weights=[];
        for(let i=0;i<geometry.attributes.position.count;i++){ids.push(bone,0,0,0);weights.push(1,0,0,0);}geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(ids,4));geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));
      }
      const key=mesh.material.uuid+Object.keys(geometry.attributes).sort().join(',');if(!groups.has(key))groups.set(key,{material:mesh.material,parts:[]});groups.get(key).parts.push(geometry);
    });
    const capacity=entities.filter(e=>e.profile===profile.id).length||1,lods=[[],[],[],[]],sources=[];
    for(const {material,parts}of groups.values()){
      const merged=mergeGeometries(parts);parts.forEach(p=>p.dispose());if(!merged)continue;
      const fragmentMaterial=material.clone();fragmentMaterial.onBeforeCompile=material.onBeforeCompile;fragmentMaterial.customProgramCacheKey=material.customProgramCacheKey;
      sources.push({geometry:merged.clone(),material:fragmentMaterial});
      for(let lod=0;lod<4;lod++){
        await yieldJob();
        const geometry=await clusterGeometryAsync(merged,[0,.032,.12,.28][lod]);
        geometry.setAttribute('npcPose',new THREE.InstancedBufferAttribute(new Float32Array(capacity*4),4).setUsage(THREE.DynamicDrawUsage));
        geometry.setAttribute('npcWound',new THREE.InstancedBufferAttribute(new Float32Array(capacity),1));
        geometry.setAttribute('npcSever',new THREE.InstancedBufferAttribute(new Float32Array(capacity),1));
        geometry.setAttribute('npcState',new THREE.InstancedBufferAttribute(new Float32Array(capacity*2),2).setUsage(THREE.DynamicDrawUsage));
        const mesh=new THREE.InstancedMesh(geometry,instancedNPCMaterial(material,palette,ragdolls),capacity);mesh.name=profile.id+' / LOD '+lod;mesh.count=0;mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.receiveShadow=true;if(blood)bloodShader(mesh.material,blood,{instance:true});
        severShader(mesh.material,{instanced:true});
        // Contact shading stays stable while distant silhouettes are simplified.
        root.add(mesh);lods[lod].push(mesh);allBatches.push(mesh);
      }
      merged.dispose();
    }
    fragmentSources.set(profile.id,sources);sets.set(profile.id,lods);source.dispose();onProgress(++compiled,profiles.length);await new Promise(resolve=>setTimeout(resolve,0));
  }
  const frustum=new THREE.Frustum(),projection=new THREE.Matrix4(),matrix=new THREE.Matrix4(),rotation=new THREE.Quaternion(),scale=new THREE.Vector3(),position=new THREE.Vector3(),sphere=new THREE.Sphere(new THREE.Vector3(),2.5),fallRotation=new THREE.Quaternion();
  const groundGeometry=new THREE.CircleGeometry(.3,12);groundGeometry.rotateX(-Math.PI/2);
  const contacts=new THREE.InstancedMesh(groundGeometry,new THREE.MeshBasicMaterial({color:'#26372e',transparent:true,opacity:.20,depthWrite:false}),entities.length);contacts.count=0;contacts.frustumCulled=false;root.add(contacts);
  let counts=[0,0,0,0],visible=0,triangles=0;
  function update(camera,time,dt=1/60){
    camera.updateMatrixWorld();frustum.setFromProjectionMatrix(projection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));counts=[0,0,0,0];visible=0;triangles=0;contacts.count=0;horses?.begin();
    for(const mesh of allBatches)mesh.count=0;let promoted=0,fragmentBudget=1;
    for(const entity of entities){
      let state=states.get(entity.id);if(!state){state={lod:-1,clip:0,phase:0,oldClip:0,oldPhase:0,changedAt:0,ground:0};states.set(entity.id,state);}
      const dead=entity.hp<=0,deathAge=time-entity.deadAt,hidden=entity.hidden||dead&&deathAge>25;
      if(!dead){state.wasDead=false;state.fragmentSpawned=false;if(ragdolls.records.has(entity.id))ragdolls.remove(entity.id);fragments.remove(entity.id);}
      if(hidden){ragdolls.remove(entity.id);fragments.remove(entity.id);continue;}
      const x=entity.position?.x??entity.x,z=entity.position?.z??entity.z,y=entity.position?.y??height(x,z);
      position.set(x,y,z);const distance=position.distanceTo(camera.position);if(distance>Math.min(850,scene.fog?.far??850))continue;
      sphere.center.copy(position);sphere.center.y+=entity.mounted?1.9:.9;if(!frustum.intersectsSphere(sphere))continue;
      state.lod=npcLOD(distance,state.lod);const lod=state.lod;
      const attacking=entity.strike||time-entity.attackAt<entity.attack.duration;
      const family=entity.attack?.grip??weaponAction(entity.weapon).grip,base=paletteBase(family,entity.mounted);
      let clip=dead?state.clip-base:attacking?3+(Math.max(0,entity.strikes-1)%2):entity.speed>2?2:entity.speed>.08?1:time-entity.blockAt<.42?5:0;
      clip+=base;
      let phase=attacking?Math.min(.999,(time-entity.attackAt)/entity.attack.duration):(entity.phase+time*(clip%6===2?1.6:clip%6===1?1.1:.45))%1;
      if(dead){if(!state.wasDead){state.deathClip=state.clip;state.deathPhase=state.phase;state.wasDead=true;}clip=state.deathClip;phase=state.deathPhase;}
      if(clip!==state.clip){state.oldClip=state.clip;state.oldPhase=state.phase;state.changedAt=time;}state.clip=clip;state.phase=phase;
      let rag=ragdolls.records.get(entity.id);
      if(dead&&!rag&&distance<32&&promoted<2&&ragdolls.active<16){
        const row=clip*palette.frames+Math.floor(phase*(palette.frames-1)),matrices=palette.data.subarray(row*palette.width*4,row*palette.width*4+palette.rig.skeleton.bones.length*16);
        const impulse=new THREE.Vector3(entity.hitDirection?.x??-Math.sin(entity.yaw),.3,entity.hitDirection?.z??-Math.cos(entity.yaw)).multiplyScalar(2.3);
        rag=ragdolls.add(entity.id,{matrices,origin:position.clone(),yaw:entity.yaw,scale:entity.scale??1,height,impulse});
        if(rag){promoted++;if(deathAge>2)for(let i=0;i<46;i++)rag.pose.update(.1);}
      }
      if(entity.mounted&&!dead){horses?.add(entity,position,distance,time);position.y+=1.64-.94*(entity.scale??1);}
      rotation.setFromAxisAngle(THREE.Object3D.DEFAULT_UP,entity.yaw??0);
      if(dead&&!rag){const fall=Math.min(1,deathAge/.85)*1.48,angle=Math.atan2(entity.hitDirection?.x??-Math.sin(entity.yaw),entity.hitDirection?.z??-Math.cos(entity.yaw))-entity.yaw;fallRotation.setFromAxisAngle(new THREE.Vector3(-Math.cos(angle),0,Math.sin(angle)),fall);rotation.multiply(fallRotation);position.y+=.15;}
      scale.setScalar(entity.scale??1);matrix.compose(position,rotation,scale);
      if(dead&&entity.severedPart&&distance<40){
        const row=clip*palette.frames+Math.floor(phase*(palette.frames-1));
        const bones=rag?ragdolls.data.subarray(rag.slot*ragdolls.width*4):palette.data.subarray(row*palette.width*4);
        if(!state.fragmentSpawned&&fragmentBudget){fragments.spawn(entity.id,entity.severedPart,fragmentSources.get(entity.profile),bones,matrix,entity.hitDirection);fragmentBudget--;state.fragmentSpawned=fragments.records.has(entity.id);}
        fragments.updateStump(entity.id,bones,palette.rig,matrix);
      }
      const meshes=sets.get(entity.profile)?.[lod];if(!meshes)continue;
      for(const mesh of meshes){const i=mesh.count++;mesh.setMatrixAt(i,matrix);mesh.geometry.attributes.npcPose.setXYZW(i,clip,phase,state.oldClip,state.oldPhase);mesh.geometry.attributes.npcSever.setX(i,dead?(BODY_PARTS[entity.severedPart]?.code??0):0);mesh.geometry.attributes.npcWound.setX(i,entity.woundSlot??-1);mesh.geometry.attributes.npcState.setXY(i,Math.min(1,(time-state.changedAt)/.14),rag?.slot??-1);triangles+=(mesh.geometry.index?.count??mesh.geometry.attributes.position.count)/3;}
      if(!dead&&distance<48){matrix.makeScale(entity.scale??1,1,entity.scale??1).setPosition(x,y+.012,z);contacts.setMatrixAt(contacts.count++,matrix);}
      counts[lod]++;visible++;
    }
    horses?.end();
    ragdolls.update(dt);
    fragments.update(dt);
    for(const mesh of allBatches){mesh.visible=mesh.count>0;if(!mesh.count)continue;
      for(const attribute of [mesh.instanceMatrix,...['npcPose','npcState','npcWound','npcSever'].map(id=>mesh.geometry.attributes[id])]){
        attribute.clearUpdateRanges();attribute.addUpdateRange(0,mesh.count*attribute.itemSize);attribute.needsUpdate=true;
      }
    }
    if(contacts.count){contacts.instanceMatrix.clearUpdateRanges();contacts.instanceMatrix.addUpdateRange(0,contacts.count*16);contacts.instanceMatrix.needsUpdate=true;}contacts.visible=contacts.count>0;
  }
  function posePoint(entity){
    const part=BODY_PARTS[entity.lastImpact?.zone],local=new THREE.Vector3(...(part?.point??[0,1.24,.1])),bone=part?.bone??'chest';
    const state=states.get(entity.id),index=palette.rig.segments.find(s=>s.name===bone).index;
    const row=(state?.clip??0)*palette.frames+Math.floor((state?.phase??0)*(palette.frames-1));
    local.applyMatrix4(new THREE.Matrix4().fromArray(palette.data,row*palette.width*4+index*16));
    if(entity.mounted)local.y+=(1.64-.94*(entity.scale??1))/(entity.scale??1);
    return local.multiplyScalar(entity.scale??1).applyAxisAngle(THREE.Object3D.DEFAULT_UP,entity.yaw??0).add(entity.position);
  }
  if(renderer&&camera){
    // Compiling a whole army at once still queues hundreds of programs in one
    // JS task on some drivers. Submit one mesh at a time between frame yields.
    const meshes=[];root.traverse(o=>{if(o.isMesh)meshes.push(o);});
    await warmMeshes(renderer,camera,scene,meshes);
    const textures=new Set([palette.texture,ragdolls.texture]);
    for(const mesh of allBatches)for(const value of Object.values(mesh.material))if(value?.isTexture)textures.add(value);
    for(const texture of textures){renderer.initTexture(texture);await yieldJob();}
  }
  root.visible=true;
  return {root,update,ragdolls,fragments,states,posePoint,stats:()=>({visible,lodCounts:[...counts],triangles,profiles:profiles.length,...horses?.stats(),ragdolls:ragdolls.active,settledBodies:ragdolls.records.size-ragdolls.active,fragments:fragments.records.size,paletteBytes:palette.data.byteLength,cpuSkeletons:ragdolls.active,liveClothInstances:0}),
    dispose(){horses?.dispose();root.removeFromParent();for(const mesh of allBatches){mesh.geometry.dispose();mesh.material.dispose();mesh.dispose();}for(const sources of fragmentSources.values())for(const s of sources){s.geometry.dispose();s.material.dispose();}fragments.dispose();contacts.geometry.dispose();contacts.material.dispose();contacts.dispose();ragdolls.dispose();palette.texture.dispose();}};
}
