import * as THREE from 'three';
import {publicUrl} from '../assets/public-url.js';
import {createBaseRig} from '../avatar/rig.js';
import {CharacterAnimator} from '../game/animation.js';
import {JobAnimation} from '../npc/job-animation.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {SWORD_GRIP,swordGripOrientation} from '../game/weapon-sockets.js';

export const CROWD_LODS=Object.freeze([{distance:22,label:'near proxy'},{distance:60,label:'mid proxy'},{distance:Infinity,label:'far proxy'}]);
export function crowdLOD(distance){return distance<22?0:distance<60?1:2;}

/** Once per library, bake the actual rig controller into a GPU matrix palette.
 * Instances choose their own clip, phase and speed; no 5,000 CPU skeletons. */
export function bakeAnimationPalette(frames=60,extended=false){
  const root=new THREE.Group(),rig=createBaseRig(root),animator=new CharacterAnimator({root,rig});
  const jobs=extended?new JobAnimation({root,rig}):null,clips=extended?7:3;
  const width=THREE.MathUtils.ceilPowerOfTwo(rig.skeleton.bones.length*4),height=frames*clips;
  const data=new Float32Array(width*height*4);
  for(let clip=0;clip<clips;clip++){
    const speed=[0,1.45,3.9,0,0,0,1.2][clip];
    for(let warm=0;warm<120;warm++)animator.update(1/60,{speed,weapon:'unarmed',grounding:false});
    for(let frame=0;frame<frames;frame++){
      const action=clip===3?{kind:'sword',style:'cut',side:'R',combo:0,height:1.25,progress:frame/frames}:null;
      animator.update(1/60,{speed,weapon:clip===3||clip===4?'sword':'unarmed',action,block:clip===4,scrubPhase:frame/frames,grounding:false});
      if(clip>=5)jobs.update(1/60,clip===5?'hammer':'carry',false);
      root.updateMatrixWorld(true);rig.skeleton.update();data.set(rig.skeleton.boneMatrices,(clip*frames+frame)*width*4);
    }
  }
  const texture=new THREE.DataTexture(data,width,height,THREE.RGBAFormat,THREE.FloatType);texture.needsUpdate=true;
  root.traverse(node=>{if(node.isMesh){node.geometry.dispose();node.material.dispose();}});
  return {texture,frames,bones:rig.skeleton.bones.length,bytes:data.byteLength,hand:rig.skeleton.bones.indexOf(rig.bones.handR),head:rig.skeleton.bones.indexOf(rig.bones.head)};
}

export function crowdMaterial(palette,time){
  const material=new THREE.MeshToonMaterial({vertexColors:true});
  material.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,{crowdPalette:{value:palette.texture},crowdTime:time,crowdFrames:{value:palette.frames}});
    shader.vertexShader=shader.vertexShader.replace('#include <common>',`#include <common>
      attribute vec4 skinIndex; attribute vec4 skinWeight; attribute vec3 animation;
      attribute vec3 clothColor; attribute vec3 pantsColor; attribute vec3 skinColor; attribute vec3 hairColor;
      uniform highp sampler2D crowdPalette; uniform float crowdTime; uniform float crowdFrames;
      mat4 crowdBone(float index,float row){int x=int(index)*4;int y=int(row);
        return mat4(texelFetch(crowdPalette,ivec2(x,y),0),texelFetch(crowdPalette,ivec2(x+1,y),0),texelFetch(crowdPalette,ivec2(x+2,y),0),texelFetch(crowdPalette,ivec2(x+3,y),0));}
      mat4 crowdPose(float row){return crowdBone(skinIndex.x,row)*skinWeight.x+crowdBone(skinIndex.y,row)*skinWeight.y+crowdBone(skinIndex.z,row)*skinWeight.z+crowdBone(skinIndex.w,row)*skinWeight.w;}
    `);
    shader.vertexShader=shader.vertexShader.replace('#include <beginnormal_vertex>',`#include <beginnormal_vertex>
      float frame=fract(crowdTime*animation.z+animation.y)*crowdFrames;
      float offset=animation.x*crowdFrames;
      mat4 skinA=crowdPose(offset+floor(frame));mat4 skinB=crowdPose(offset+mod(floor(frame)+1.0,crowdFrames));
      mat4 crowdSkin=skinA*(1.0-fract(frame))+skinB*fract(frame);
      objectNormal=mat3(crowdSkin)*objectNormal;
    `);
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','vec3 transformed=(crowdSkin*vec4(position,1.0)).xyz;');
    shader.vertexShader=shader.vertexShader.replace('#include <color_vertex>',`#include <color_vertex>
      if(color.b>color.r*2.0&&color.b>.15)vColor.rgb=clothColor;
      else if(color.r>.75&&color.g>.45)vColor.rgb=skinColor;
      else if(color.b>color.r&&color.b<.13)vColor.rgb=pantsColor;
      else if(max(max(color.r,color.g),color.b)<.018)vColor.rgb=hairColor;
    `);
  };
  material.customProgramCacheKey=()=> 'crowd-palette-colours-v2';return material;
}
async function loadLOD(level){
  const response=await fetch(publicUrl(`/models/crowd-lod${level}.json`));if(!response.ok)throw new Error('Bake crowd LODs first');
  const data=await response.json(),g=new THREE.BufferGeometry();
  for(const [name,size] of Object.entries({position:3,normal:3,color:3,skinIndex:4,skinWeight:4}))g.setAttribute(name,new THREE.Float32BufferAttribute(data[name],size));
  g.setIndex(data.index);g.computeBoundingSphere();return g;
}

/** Static spatial cells are the first HLOD level. Inside a visible cell, actors
 * enter geometry/LOD batches. Aggregate impostor cells can replace the far tier. */
export async function createCrowd(scene,capacity=5000,options={}){
  const palette=bakeAnimationPalette(60,Boolean(options.extended)),time={value:0};
  const geometries=await Promise.all([0,1,2].map(loadLOD));
  for(let i=0;i<3;i++){
    const hair=new THREE.SphereGeometry(.113,12-i*2,6-i,0,Math.PI*2,0,Math.PI*.48);hair.scale(1,1,1.08);hair.translate(0,1.675,-.02);hair.deleteAttribute('uv');
    const count=hair.attributes.position.count,colors=[],indices=[],weights=[];
    for(let n=0;n<count;n++){colors.push(.012,.009,.006);indices.push(palette.head,0,0,0);weights.push(1,0,0,0);}
    hair.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));hair.setAttribute('skinIndex',new THREE.Float32BufferAttribute(indices,4));hair.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));
    const old=geometries[i],body=old.toNonIndexed(),cap=hair.toNonIndexed();geometries[i]=mergeGeometries([body,cap]);geometries[i].setIndex(Array.from({length:geometries[i].attributes.position.count},(_,n)=>n));old.dispose();body.dispose();cap.dispose();hair.dispose();
  }
  if(options.weapons)for(let i=0;i<3;i++){
    const blade=new THREE.BoxGeometry(.035,.9,.018);blade.translate(0,.54,0);blade.deleteAttribute('uv');
    blade.applyQuaternion(swordGripOrientation());blade.translate(-.84+SWORD_GRIP.position[0],1.418+SWORD_GRIP.position[1],SWORD_GRIP.position[2]);
    const count=blade.attributes.position.count,color=[],indices=[],weights=[];
    for(let n=0;n<count;n++){color.push(.73,.8,.84);indices.push(palette.hand,0,0,0);weights.push(1,0,0,0);}
    blade.setAttribute('color',new THREE.Float32BufferAttribute(color,3));blade.setAttribute('skinIndex',new THREE.Float32BufferAttribute(indices,4));blade.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));
    const old=geometries[i],body=old.toNonIndexed(),sword=blade.toNonIndexed();geometries[i]=mergeGeometries([body,sword]);
    geometries[i].setIndex(Array.from({length:geometries[i].attributes.position.count},(_,n)=>n));old.dispose();body.dispose();sword.dispose();blade.dispose();
  }
  const batches=geometries.map(g=>{
    g.setAttribute('animation',new THREE.InstancedBufferAttribute(new Float32Array(capacity*3),3));
    for(const name of ['clothColor','pantsColor','skinColor','hairColor'])g.setAttribute(name,new THREE.InstancedBufferAttribute(new Float32Array(capacity*3),3));
    const mesh=new THREE.InstancedMesh(g,crowdMaterial(palette,time),capacity);mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.frustumCulled=false;mesh.count=0;scene.add(mesh);return mesh;
  });
  const actors=options.actors??[],cells=new Map(),columns=Math.ceil(Math.sqrt(capacity));
  for(let i=0;!options.actors&&i<capacity;i++){
    const x=((i%columns)-columns/2)*2.25,z=(Math.floor(i/columns)-columns/2)*2.25;
    const actor={position:new THREE.Vector3(x,0,z),matrix:new THREE.Matrix4().makeTranslation(x,0,z),clip:i%3,phase:((i*7919)%1000)/1000,speed:[.65,1.05,1.55][i%3],tint:new THREE.Color().setHSL((i%7)*.04+.02,.06,.83)};actors.push(actor);
  }
  function rebuildCells(){cells.clear();for(let i=0;i<actors.length;i++){const actor=actors[i];if(actor.hidden||actor.promoted)continue;const {x,z}=actor.position,key=`${Math.floor(x/18)},${Math.floor(z/18)}`;if(!cells.has(key))cells.set(key,{actors:[],box:new THREE.Box3()});const cell=cells.get(key);cell.actors.push(i);cell.box.expandByPoint(actor.position.clone().add(new THREE.Vector3(-1,0,-1)));cell.box.expandByPoint(actor.position.clone().add(new THREE.Vector3(1,3,1)));}}
  rebuildCells();
  const frustum=new THREE.Frustum(),matrix=new THREE.Matrix4(),assignments=[];
  const defaults={clothColor:new THREE.Color('#376785'),pantsColor:new THREE.Color('#43494f'),skinColor:new THREE.Color('#dbaf8d'),hairColor:new THREE.Color('#40312a')};
  let counts=[0,0,0],lastUpdate=-1,active=capacity,forceLOD=-1,culled=0,lastPromoted=0;
  function update(camera,seconds,force=false){
    time.value=seconds;
    const promoted=actors.filter(a=>a.promoted).length;if(promoted!==lastPromoted||assignments.some(({actor})=>actor.promoted||actor.hidden)){force=true;lastPromoted=promoted;}
    if(!force&&seconds-lastUpdate<.2){
      if(options.dynamic){for(const {actor,mesh,index}of assignments){mesh.setMatrixAt(index,actor.matrix);mesh.geometry.attributes.animation.setXYZ(index,actor.clip,actor.phase,actor.speed);}for(const mesh of batches){mesh.instanceMatrix.needsUpdate=true;mesh.geometry.attributes.animation.needsUpdate=true;}}
      return;
    }lastUpdate=seconds;assignments.length=0;
    if(options.dynamic)rebuildCells();
    camera.updateMatrixWorld();frustum.setFromProjectionMatrix(matrix.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));counts=[0,0,0];culled=0;
    for(const cell of cells.values()){
      if(!frustum.intersectsBox(cell.box)){culled++;continue;}
      for(const i of cell.actors){if(i>=active)continue;const actor=actors[i],lod=forceLOD>=0?forceLOD:crowdLOD(actor.position.distanceTo(camera.position)),mesh=batches[lod],index=counts[lod]++;
        mesh.setMatrixAt(index,actor.matrix);mesh.setColorAt(index,actor.tint);mesh.geometry.attributes.animation.setXYZ(index,actor.clip,actor.phase,actor.speed);
        assignments.push({actor,mesh,index});
        for(const name of Object.keys(defaults)){const color=actor[name]??defaults[name];mesh.geometry.attributes[name].setXYZ(index,color.r,color.g,color.b);}
      }
    }
    for(let i=0;i<3;i++){const mesh=batches[i];mesh.count=counts[i];mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;mesh.geometry.attributes.animation.needsUpdate=true;for(const name of Object.keys(defaults))mesh.geometry.attributes[name].needsUpdate=true;}
  }
  return {update,batches,palette,actors,setCount(n){active=Math.min(capacity,Math.max(0,Math.floor(n)));lastUpdate=-1;},setLOD(n){forceLOD=n;lastUpdate=-1;},
    stats(){return {active,visible:counts.reduce((a,b)=>a+b,0),lodCounts:counts.slice(),cells:cells.size,culledCells:culled,triangles:counts.reduce((sum,n,i)=>sum+n*geometries[i].index.count/3,0),paletteBytes:palette.bytes,cpuSkeletons:0,liveClothInstances:0};},
    dispose(){for(const mesh of batches){mesh.removeFromParent();mesh.geometry.dispose();mesh.material.dispose();mesh.dispose();}palette.texture.dispose();},
  };
}
