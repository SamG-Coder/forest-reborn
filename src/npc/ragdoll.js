import * as THREE from 'three';
import {createBaseRig} from '../avatar/rig.js';

const links=[['hips','spine'],['spine','chest'],['chest','neck'],['neck','head'],['head','headTop']];
for(const side of ['L','R'])links.push(['chest','clavicle'+side],['clavicle'+side,'upperArm'+side],['upperArm'+side,'forearm'+side],['forearm'+side,'hand'+side],['hand'+side,'handEnd'+side],['hips','thigh'+side],['thigh'+side,'shin'+side],['shin'+side,'foot'+side],['foot'+side,'toe'+side],['toe'+side,'toeEnd'+side]);
const radii={hips:.13,spine:.13,chest:.15,neck:.065,head:.095,headTop:.09};
const v=new THREE.Vector3(),q=new THREE.Quaternion(),parentQ=new THREE.Quaternion();

/** Small articulated position-based ragdoll. Terrain contact is evaluated at
 * each joint; impact direction comes from the actual attacker. */
export class RagdollPose {
  constructor({matrices,origin,transform,yaw=0,scale=1,height=()=>0,impulse=new THREE.Vector3(0,0,-2)}){
    this.root=new THREE.Group();this.rig=createBaseRig(this.root);this.height=height;this.time=0;this.accumulator=0;this.settled=false;
    this.transform=transform?.clone()??new THREE.Matrix4().compose(origin,new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),yaw),new THREE.Vector3().setScalar(scale));this.inverse=this.transform.clone().invert();
    this.points=new Map();this.constraints=[];const matrix=new THREE.Matrix4();
    const add=(name,rest,index)=>{if(this.points.has(name))return;matrix.fromArray(matrices,index*16);const point=rest.clone().applyMatrix4(matrix).applyMatrix4(this.transform);const lift=Math.max(.1,point.y-origin.y);
      this.points.set(name,{position:point,previous:point.clone().addScaledVector(impulse,-1/60*(.6+lift*.45)),radius:(radii[name]??(/hand|toe/.test(name)?.04:/foot/.test(name)?.06:.06))*scale,mass:name==='hips'||name==='chest'?.65:1});};
    for(const [start,end]of links){const segment=this.rig.segments.find(s=>s.name===start);if(!segment)continue;add(start,segment.start,segment.index);const child=this.rig.segments.find(s=>s.name===end);add(end,child?.start??segment.end,child?.index??segment.index);}
    const constraint=(a,b,min=1,max=1)=>{const pa=this.points.get(a),pb=this.points.get(b);if(!pa||!pb)return;const length=pa.position.distanceTo(pb.position);this.constraints.push({a:pa,b:pb,min:length*min,max:length*max});};
    links.forEach(([a,b])=>constraint(a,b));
    for(const [a,b]of [['hips','chest'],['spine','neck'],['chest','head'],['upperArmL','upperArmR'],['thighL','thighR'],['clavicleL','hips'],['clavicleR','hips']])constraint(a,b);
    for(const s of ['L','R']){constraint('upperArm'+s,'hand'+s,.45,1.08);constraint('thigh'+s,'foot'+s,.40,1.08);}
    this.apply();
  }
  update(dt){
    if(this.settled)return false;this.accumulator=Math.min(.15,this.accumulator+dt);
    while(this.accumulator>=1/60){this.accumulator-=1/60;this.time+=1/60;
      for(const point of this.points.values()){const current=point.position.clone();point.position.add(v.copy(point.position).sub(point.previous).multiplyScalar(.992));point.position.y-=9.81/3600;point.previous.copy(current);}
      for(let iteration=0;iteration<10;iteration++){
        for(const c of this.constraints){v.copy(c.b.position).sub(c.a.position);const d=v.length();if(d<1e-7)continue;const wanted=THREE.MathUtils.clamp(d,c.min,c.max),error=(d-wanted)/d/(c.a.mass+c.b.mass);c.a.position.addScaledVector(v,error*c.a.mass);c.b.position.addScaledVector(v,-error*c.b.mass);}
        for(const p of this.points.values()){const floor=this.height(p.position.x,p.position.z)+p.radius;if(p.position.y<floor){p.position.y=floor;p.previous.x+=(p.position.x-p.previous.x)*.45;p.previous.z+=(p.position.z-p.previous.z)*.45;p.previous.y=p.position.y;}}
      }
    }
    this.apply();if(this.time>=4.5)this.settled=true;return true;
  }
  apply(){
    for(const [start,end]of links){const bone=this.rig.bones[start],a=this.points.get(start),b=this.points.get(end);if(!bone||!a||!b)continue;
      const pa=a.position.clone().applyMatrix4(this.inverse),pb=b.position.clone().applyMatrix4(this.inverse),segment=this.rig.segments.find(s=>s.name===start);
      q.setFromUnitVectors(v.copy(segment.end).sub(segment.start).normalize(),pb.sub(pa).normalize());
      bone.parent.updateWorldMatrix(true,false);bone.position.copy(bone.parent.worldToLocal(pa));bone.parent.getWorldQuaternion(parentQ);bone.quaternion.copy(parentQ.invert().multiply(q));bone.updateMatrixWorld(true);
    }
    this.root.updateMatrixWorld(true);this.rig.skeleton.update();
  }
  copyTo(rig){for(const [name,bone]of Object.entries(rig.bones)){const source=this.rig.bones[name];bone.position.copy(source.position);bone.quaternion.copy(source.quaternion);}rig.bones.hips.updateWorldMatrix(true,true);rig.skeleton.update();}
  get matrices(){return this.rig.skeleton.boneMatrices;}
}

export class RagdollAtlas {
  constructor(width,capacity=64){this.width=width;this.capacity=capacity;this.data=new Float32Array(width*4*capacity);this.texture=new THREE.DataTexture(this.data,width,capacity,THREE.RGBAFormat,THREE.FloatType);this.records=new Map();this.texture.needsUpdate=true;}
  upload(record){const offset=record.slot*this.width*4;this.data.set(record.pose.matrices,offset);this.texture.addUpdateRange(offset,this.width*4);this.texture.needsUpdate=true;}
  add(id,options){if(this.records.has(id))return this.records.get(id);if(this.records.size>=this.capacity)return null;const used=new Set([...this.records.values()].map(r=>r.slot));let slot=0;while(used.has(slot))slot++;const record={slot,pose:new RagdollPose(options)};this.records.set(id,record);this.upload(record);return record;}
  update(dt){for(const record of this.records.values())if(record.pose&&(record.pose.update(dt)||record.pose.settled)){this.upload(record);if(record.pose.settled){record.settled=true;record.pose.rig.skeleton.dispose();record.pose=null;}}}
  get active(){let count=0;for(const r of this.records.values())if(r.pose)count++;return count;}
  remove(id){this.records.get(id)?.pose?.rig.skeleton.dispose();this.records.delete(id);}
  dispose(){for(const id of this.records.keys())this.remove(id);this.texture.dispose();}
}
