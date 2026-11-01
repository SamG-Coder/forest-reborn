import * as THREE from 'three';

/** Small near-character XPBD patch. Structural, shear and bend-distance
 * constraints; pin targets follow the rig. No per-triangle self collision. */
export class ClothPatch {
  constructor(geometry,columns,rows,pinTarget,{compliance=2e-8,damping=.985,maxDistance=.24,pinRows=1,motionInfluence=0}={}){
    this.geometry=geometry;this.pinTarget=pinTarget;this.compliance=compliance;this.damping=damping;this.maxDistance=maxDistance;
    this.positions=Array.from({length:geometry.attributes.position.count},(_,i)=>new THREE.Vector3().fromBufferAttribute(geometry.attributes.position,i));
    this.previous=this.positions.map(v=>v.clone());this.rest=this.positions.map(v=>v.clone());
    this.targets=this.positions.map(v=>v.clone());this.anchor=new THREE.Vector3();this.motionInfluence=motionInfluence;
    this.inverseMass=this.positions.map((_,i)=>i<columns*pinRows?0:1);
    this.constraints=[];this.accumulator=0;this.time=0;
    const add=(a,b,bend=false)=>this.constraints.push({a,b,length:this.positions[a].distanceTo(this.positions[b]),bend,lambda:0});
    for(let y=0;y<rows;y++)for(let x=0;x<columns;x++){
      const i=y*columns+x;
      if(x+1<columns)add(i,i+1);if(y+1<rows)add(i,i+columns);
      if(x+1<columns&&y+1<rows){add(i,i+columns+1);add(i+1,i+columns);}
      if(x+2<columns)add(i,i+2,true);if(y+2<rows)add(i,i+2*columns,true);
    }
  }
  reset(){this.anchor.set(0,0,0);let count=0;for(let i=0;i<this.positions.length;i++){this.pinTarget(i,this.positions[i]);this.previous[i].copy(this.positions[i]);if(!this.inverseMass[i]){this.anchor.add(this.positions[i]);count++;}}this.anchor.divideScalar(Math.max(1,count));this.accumulator=0;}
  update(dt,capsules=[],wind=0,projectLayer=null){
    this.accumulator=Math.min(this.accumulator+Math.max(0,dt),8/120);
    while(this.accumulator>=1/120){this.step(1/120,capsules,wind,projectLayer);this.accumulator-=1/120;}
    const attr=this.geometry.attributes.position;
    for(let i=0;i<this.positions.length;i++)attr.setXYZ(i,...this.positions[i]);
    attr.needsUpdate=true;this.geometry.computeVertexNormals();this.geometry.computeBoundingSphere();
  }
  step(dt,capsules,wind,projectLayer){
    this.time+=dt;const nextAnchor=new THREE.Vector3(),delta=new THREE.Vector3();let anchors=0;
    for(let i=0;i<this.positions.length;i++){this.pinTarget(i,this.targets[i]);if(!this.inverseMass[i]){nextAnchor.add(this.targets[i]);anchors++;}}
    nextAnchor.divideScalar(Math.max(1,anchors));
    // Animation-driven cloth carries most pelvis translation with its sewn
    // seam. The remaining motion, gravity and wind supply secondary motion.
    delta.copy(nextAnchor).sub(this.anchor).multiplyScalar(this.motionInfluence);
    if(this.time>dt)for(let i=0;i<this.positions.length;i++)if(this.inverseMass[i]){this.positions[i].add(delta);this.previous[i].add(delta);}
    this.anchor.copy(nextAnchor);
    for(let i=0;i<this.positions.length;i++){
      const p=this.positions[i],old=p.clone();
      if(!this.inverseMass[i])p.copy(this.targets[i]);
      else {p.add(delta.copy(p).sub(this.previous[i]).multiplyScalar(this.damping));p.y-=9.81*dt*dt;p.z+=(wind+Math.sin(this.time*2+i*.1)*wind*.3)*dt*dt;}
      this.previous[i].copy(old);
    }
    for(const c of this.constraints)c.lambda=0;
    for(let iteration=0;iteration<32;iteration++){
      for(const c of this.constraints){
        const a=this.positions[c.a],b=this.positions[c.b],wa=this.inverseMass[c.a],wb=this.inverseMass[c.b];
        delta.copy(a).sub(b);const length=delta.length();if(length<1e-8||wa+wb===0)continue;
        const alpha=this.compliance*(c.bend?2000:1)/(dt*dt),dl=(-(length-c.length)-alpha*c.lambda)/(wa+wb+alpha);c.lambda+=dl;
        delta.multiplyScalar(dl/length);a.addScaledVector(delta,wa);b.addScaledVector(delta,-wb);
      }
      for(let i=0;i<this.positions.length;i++){
        const p=this.positions[i],target=this.targets[i];
        if(!this.inverseMass[i]){p.copy(target);continue;}
        delta.copy(p).sub(target);if(delta.length()>this.maxDistance)p.copy(target).add(delta.setLength(this.maxDistance));
        for(const capsule of capsules)projectCapsule(p,capsule);
        if(projectLayer)projectLayer(p);
        p.y=Math.max(.015,p.y);
      }
    }
  }
  maxStretch(){return Math.max(...this.constraints.map(c=>this.positions[c.a].distanceTo(this.positions[c.b])/c.length));}
}

export function projectCapsule(point,{a,b,radius}){
  const x=b.x-a.x,y=b.y-a.y,z=b.z-a.z,denom=x*x+y*y+z*z;
  const t=denom?Math.max(0,Math.min(1,((point.x-a.x)*x+(point.y-a.y)*y+(point.z-a.z)*z)/denom)):0;
  const cx=a.x+x*t,cy=a.y+y*t,cz=a.z+z*t,dx=point.x-cx,dy=point.y-cy,dz=point.z-cz,distance=Math.hypot(dx,dy,dz);
  if(distance<radius){if(distance<1e-8)point.set(cx,cy,cz+radius);else{const scale=radius/distance;point.set(cx+dx*scale,cy+dy*scale,cz+dz*scale);}}
}

export function avatarCapsules(avatar,clearance=.008){
  const world=name=>avatar.root.worldToLocal(avatar.rig.bones[name].getWorldPosition(new THREE.Vector3()));
  return [['hips','chest',.125],['thighL','shinL',.115],['thighR','shinR',.115],['shinL','footL',.077],['shinR','footR',.077],['upperArmL','forearmL',.067],['upperArmR','forearmR',.067]]
    .map(([a,b,radius])=>({a:world(a),b:world(b),radius:radius+clearance}));
}
