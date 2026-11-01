import * as THREE from 'three';
import {BODY_PARTS} from '../game/hit-impact.js';

export function bloodShader(material,blood,{instance=false,slot=-1}={}){
  if(!instance)material.fragmentBase??={compile:material.onBeforeCompile.bind(material),key:material.customProgramCacheKey()};
  const compile=material.onBeforeCompile.bind(material),key=material.customProgramCacheKey();
  material.onBeforeCompile=shader=>{
    compile(shader);Object.assign(shader.uniforms,{bloodWounds:{value:blood.wounds},bloodSlot:{value:slot}});
    shader.vertexShader=shader.vertexShader.replace('#include <common>',`#include <common>\nvarying vec3 woundRest; varying float woundSlot; ${instance?'attribute float npcWound;':'uniform float bloodSlot;'}`);
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>\nwoundRest=position;woundSlot=${instance?'npcWound':'bloodSlot'};`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 woundRest; varying float woundSlot; uniform highp sampler2D bloodWounds;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      if(woundSlot>=0.){float stain=0.;for(int wi=0;wi<4;wi++){vec4 w=texelFetch(bloodWounds,ivec2(wi,int(woundSlot)),0);float d=distance(woundRest,w.xyz);float grain=sin(woundRest.x*187.+woundRest.y*221.)*sin(woundRest.z*143.);stain=max(stain,(1.-smoothstep(w.w*.55,w.w,d+grain*.004))*step(.001,w.w));}diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.19,.009,.012),stain*.87);}
    `);
  };material.customProgramCacheKey=()=>key+'|blood-'+(instance?'instanced':slot);material.needsUpdate=true;
}

/** Fixed-capacity particles and terrain-conforming, texture-baked stains. */
export class BloodEffects {
  constructor(scene,height,{capacity=1200,characters=1200,surfaceStep=.5}={}){
    this.scene=scene;this.height=height;this.capacity=capacity;this.particles=[];this.tiles=new Map();this.serial=0;this.time=0;this.slots=new Map();this.characters=characters;
    this.tileSegments=Math.ceil(6/surfaceStep);this.tileSize=this.tileSegments*surfaceStep;this.fadeAt=0;
    this.woundData=new Float32Array(characters*16);this.wounds=new THREE.DataTexture(this.woundData,4,characters,THREE.RGBAFormat,THREE.FloatType);this.wounds.needsUpdate=true;
    this.mesh=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.014,0),new THREE.MeshBasicMaterial({color:'#801a1c'}),capacity);this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.mesh.frustumCulled=false;this.mesh.count=0;scene.add(this.mesh);this.dummy=new THREE.Object3D();
  }
  register(target){if(this.slots.has(target.id))return this.slots.get(target.id);if(this.slots.size>=this.characters)return -1;const slot=this.slots.size;this.slots.set(target.id,slot);target.woundSlot=slot;const actor=target.controller??target.person?.actor;if(actor?.root)actor.root.traverse(o=>{if(o.isMesh&&!o.material.userData.blood){bloodShader(o.material,this,{slot});o.material.userData.blood=true;}});return slot;}
  clear(target){const slot=this.slots.get(target.id);if(slot===undefined)return;this.woundData.fill(0,slot*16,slot*16+16);this.wounds.addUpdateRange(slot*16,16);this.wounds.needsUpdate=true;}
  hit(target,attacker,amount,observer=null,posedPoint=null){
    const p=target.position??new THREE.Vector3(target.x,0,target.z);if(observer&&p.distanceTo(observer)>65)return;
    const from=attacker?.position??attacker??new THREE.Vector3(p.x,p.y,p.z+1),direction=new THREE.Vector3(target.lastImpact?.direction.x??p.x-from.x,.18,target.lastImpact?.direction.z??p.z-from.z).normalize();target.hitDirection={x:direction.x,z:direction.z};
    const slot=this.register(target),index=this.serial++%4,part=BODY_PARTS[target.lastImpact?.zone],local=new THREE.Vector3(...(part?.point??[0,1.2,.1]));
    const yaw=target.yaw??target.root?.rotation.y??0,point=posedPoint?.clone()??local.clone();
    if(!posedPoint){
      const actor=target.controller??target.person?.actor,rig=actor?.avatar?.rig;
      if(rig){actor.root.updateMatrixWorld(true);rig.skeleton.update();const bone=rig.segments.find(s=>s.name===(part?.bone??'chest'));point.applyMatrix4(new THREE.Matrix4().fromArray(rig.skeleton.boneMatrices,bone.index*16)).applyMatrix4(actor.root.matrixWorld);}
      else point.multiplyScalar(target.scale??1).applyAxisAngle(THREE.Object3D.DEFAULT_UP,yaw).add(p);
    }
    if(slot>=0){this.woundData.set([...local,Math.min(.13,.045+amount*.0018)],slot*16+index*4);this.wounds.addUpdateRange(slot*16,16);this.wounds.needsUpdate=true;}
    const severed=target.hp<=0&&target.severedPart,burst=severed?20:7;
    if(severed)direction.y=part?.bone==='neck'?.8:.28;
    for(let i=0;i<burst;i++){
      if(this.particles.length>=this.capacity)this.particles.shift();const r=((this.serial*97+i*31)%101)/101,a=i*2.399;
      this.particles.push({p:point.clone(),v:direction.clone().multiplyScalar((severed?2:1.1)+r*1.8).add(new THREE.Vector3(Math.sin(a)*.5,r*(severed?1:2.2),Math.cos(a)*.5)),life:.65+r*.45,scale:.6+r});
    }
    if(target.hp<=0||this.serial%3===0)this.stain(p.x+direction.x*.18,p.z+direction.z*.18,target.hp<=0?.22:.055+Math.min(.055,amount*.0015),direction);
  }
  tile(tx,tz){
    const size=this.tileSize,key=tx+','+tz;let tile=this.tiles.get(key);
    if(!tile){
      if(this.tiles.size>=48){const [oldKey,old]=this.tiles.entries().next().value;old.mesh.removeFromParent();old.mesh.geometry.dispose();old.mesh.material.dispose();old.texture.dispose();this.tiles.delete(oldKey);}
      const canvas=document.createElement('canvas');canvas.width=canvas.height=512;const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.generateMipmaps=false;texture.minFilter=THREE.LinearFilter;
      const geometry=new THREE.PlaneGeometry(size,size,this.tileSegments,this.tileSegments);geometry.rotateX(-Math.PI/2);const p=geometry.attributes.position;
      for(let i=0;i<p.count;i++){const wx=p.getX(i)+(tx+.5)*size,wz=p.getZ(i)+(tz+.5)*size;p.setXYZ(i,wx,this.height(wx,wz)+.006,wz);}geometry.computeVertexNormals();geometry.computeBoundingSphere();
      const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}));mesh.renderOrder=2;this.scene.add(mesh);tile={canvas,texture,mesh,at:this.time};this.tiles.set(key,tile);
    }
    return tile;
  }
  stain(x,z,radius,direction){
    // One world-space stamp is clipped into every touched tile. No cut edge at
    // the tile boundary, including droplets whose centres lie outside it.
    const size=this.tileSize,extent=radius*3;
    for(let tx=Math.floor((x-extent)/size);tx<=Math.floor((x+extent)/size);tx++)for(let tz=Math.floor((z-extent)/size);tz<=Math.floor((z+extent)/size);tz++){
      const tile=this.tile(tx,tz),ctx=tile.canvas.getContext('2d'),pixels=tile.canvas.width;
      const u=(x/size-tx)*pixels,v=(z/size-tz)*pixels,r=radius/size*pixels;
      ctx.save();ctx.translate(u,v);ctx.rotate(Math.atan2(direction.z,direction.x));ctx.scale(1,.7);
      const gradient=ctx.createRadialGradient(0,0,0,0,0,r);gradient.addColorStop(0,'#601c19b0');gradient.addColorStop(.65,'#681d1990');gradient.addColorStop(1,'#681d1900');
      ctx.fillStyle=gradient;ctx.fillRect(-r,-r,r*2,r*2);ctx.restore();ctx.fillStyle='#671d1970';
      for(let i=0;i<9;i++){const a=i*2.399;ctx.beginPath();ctx.arc(u+Math.cos(a)*r*(1+i*.2),v+Math.sin(a)*r*(1+i*.2),Math.max(.35,r*.15),0,Math.PI*2);ctx.fill();}
      tile.at=this.time;tile.texture.needsUpdate=true;
    }
  }
  update(dt,observer){
    this.time+=dt;let n=0;
    for(let i=this.particles.length-1;i>=0;i--){const p=this.particles[i];p.life-=dt;p.v.y-=dt*9.81;p.p.addScaledVector(p.v,dt);
      if(p.life<=0||p.p.y<this.height(p.p.x,p.p.z)+.01){this.particles.splice(i,1);continue;}
      this.dummy.position.copy(p.p);this.dummy.scale.set(p.scale,p.scale*1.8,p.scale);this.dummy.updateMatrix();this.mesh.setMatrixAt(n++,this.dummy.matrix);
    }
    this.mesh.count=n;this.mesh.instanceMatrix.needsUpdate=true;
    const fade=this.time-this.fadeAt>=2;if(fade)this.fadeAt=this.time;
    for(const tile of this.tiles.values()){
      tile.mesh.visible=!observer||tile.mesh.geometry.boundingSphere?.center.distanceTo(observer)<100;
      if(fade){const ctx=tile.canvas.getContext('2d');ctx.globalCompositeOperation='destination-out';ctx.fillStyle='#00000004';ctx.fillRect(0,0,tile.canvas.width,tile.canvas.height);ctx.globalCompositeOperation='source-over';tile.texture.needsUpdate=true;}
    }
  }
  reset(){this.particles.length=0;this.mesh.count=0;this.woundData.fill(0);this.wounds.needsUpdate=true;for(const tile of this.tiles.values()){tile.canvas.getContext('2d').clearRect(0,0,tile.canvas.width,tile.canvas.height);tile.texture.needsUpdate=true;}}
  dispose(){this.mesh.removeFromParent();this.mesh.geometry.dispose();this.mesh.material.dispose();this.mesh.dispose();this.wounds.dispose();for(const tile of this.tiles.values()){tile.mesh.removeFromParent();tile.mesh.geometry.dispose();tile.mesh.material.dispose();tile.texture.dispose();}}
}
