import * as THREE from 'three';

export const TARGET_RANGE = 45;
export const targetDistance = (position, target) => Math.hypot(target.position.x-position.x, target.position.z-position.z);
export function inAttackRange(position, target, reach) {
  return Boolean(target && target.hp > 0 && targetDistance(position,target) <= reach && Math.abs(target.position.y-position.y) < 1.7);
}
export function closestTarget(position,targets){
  return targets.filter(t=>t.hp>0&&targetDistance(position,t)<=TARGET_RANGE).sort((a,b)=>targetDistance(position,a)-targetDistance(position,b))[0]??null;
}
function orderedTargets(position,yaw,targets){
  return targets.filter(t=>t.hp>0 && targetDistance(position,t)<=TARGET_RANGE)
    .map(target=>({target,score:targetDistance(position,target)+Math.abs(Math.atan2(Math.sin(Math.atan2(target.position.x-position.x,target.position.z-position.z)-yaw),Math.cos(Math.atan2(target.position.x-position.x,target.position.z-position.z)-yaw)))*5}))
    .sort((a,b)=>a.score-b.score || String(a.target.id).localeCompare(String(b.target.id))).map(entry=>entry.target);
}
export function cycleTarget(current, position, yaw, targets, reverse=false) {
  const candidates=orderedTargets(position,yaw,targets);
  if(!candidates.length)return null;
  const index=candidates.indexOf(current);
  return candidates[index<0?(reverse?candidates.length-1:0):(index+(reverse?-1:1)+candidates.length)%candidates.length];
}

/** Hold the order during a short Tab sequence. Auto-facing the selected enemy
 * must not reshuffle the list before a subsequent Shift+Tab. */
export class TargetCycle {
  constructor(){this.targets=[];this.expires=0;this.origin=new THREE.Vector3();}
  next(current,position,yaw,targets,reverse=false,now=Date.now()){
    if(now>this.expires||!current||!this.targets.includes(current)||this.origin.distanceTo(position)>2){
      this.targets=orderedTargets(position,yaw,targets);this.origin.copy(position);
    }
    this.targets=this.targets.filter(t=>targets.includes(t)&&t.hp>0&&targetDistance(position,t)<=TARGET_RANGE);
    this.expires=now+1500;
    const count=this.targets.length;if(!count)return null;
    const index=this.targets.indexOf(current);
    return this.targets[index<0?(reverse?count-1:0):(index+(reverse?-1:1)+count)%count];
  }
}

/** Pick simple body volumes, so ears, fingers and animation gaps cannot spoil a click. */
export class TargetIndicator {
  constructor(scene, camera, canvas, targets, height) {
    Object.assign(this,{camera,canvas,targets,height});
    this.raycaster=new THREE.Raycaster();this.sphere=new THREE.Sphere();this.hit=new THREE.Vector3();
    const geometry=new THREE.RingGeometry(.48,.55,64);geometry.rotateX(-Math.PI/2);
    this.ring=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color:'#ffc776',side:THREE.DoubleSide,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-3}));
    this.ring.visible=false;this.ring.frustumCulled=false;scene.add(this.ring);
  }
  pick(clientX,clientY,position,targets=this.targets) {
    const rect=this.canvas.getBoundingClientRect();this.camera.updateMatrixWorld();
    this.raycaster.setFromCamera(new THREE.Vector2((clientX-rect.left)/rect.width*2-1,-(clientY-rect.top)/rect.height*2+1),this.camera);
    let selected=null,distance=Infinity;
    for(const target of targets){
      if(target.hp<=0 || !target.root.visible || targetDistance(position,target)>TARGET_RANGE)continue;
      const top=target.pickHeight??(target.kind==='rabbit'?.65:target.kind==='goblin'?1.3:1.85);
      for(let i=0;i<3;i++){
        this.sphere.center.copy(target.position).y+=top*(.25+i*.25);this.sphere.radius=target.pickRadius??top*.26;
        if(this.raycaster.ray.intersectSphere(this.sphere,this.hit)){
          const d=this.raycaster.ray.origin.distanceToSquared(this.hit);if(d<distance){distance=d;selected=target;}
        }
      }
    }
    return selected;
  }
  update(target, inRange, attacking) {
    this.ring.visible=Boolean(target && target.hp>0);if(!this.ring.visible)return;
    this.ring.position.copy(target.position);this.ring.position.y=this.height(target.position.x,target.position.z)+.04;
    this.ring.scale.setScalar(target.kind==='rabbit'?.7:1);
    const p=this.ring.geometry.attributes.position,s=this.ring.scale.x;
    for(let i=0;i<p.count;i++)p.setY(i,(this.height(target.position.x+p.getX(i)*s,target.position.z+p.getZ(i)*s)-this.ring.position.y+.045)/s);
    p.needsUpdate=true;
    this.ring.material.color.set(attacking?'#ef785d':inRange?'#ffe18d':'#9dada9');
  }
}
