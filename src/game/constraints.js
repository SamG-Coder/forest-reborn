import * as THREE from 'three';

const EPSILON = 1e-5;

/** Analytic two-bone IK. Targets and hints are WORLD space; lengths come from the rig. */
export function solveTwoBone(root, mid, tip, target, hint, orientation = null) {
  root.quaternion.identity();
  mid.quaternion.identity();
  root.updateWorldMatrix(true, true);
  const origin = root.getWorldPosition(new THREE.Vector3());
  const joint = mid.getWorldPosition(new THREE.Vector3());
  const end = tip.getWorldPosition(new THREE.Vector3());
  const a = origin.distanceTo(joint), b = joint.distanceTo(end);
  const direction = target.clone().sub(origin);
  const requested = direction.length();
  if (requested < EPSILON || a < EPSILON || b < EPSILON) return;
  direction.normalize();
  const distance = THREE.MathUtils.clamp(requested, Math.abs(a - b) + EPSILON, a + b - EPSILON);
  const reach = origin.clone().addScaledVector(direction, distance);
  const bend = hint.clone().sub(origin);
  bend.addScaledVector(direction, -bend.dot(direction));
  if (bend.lengthSq() < EPSILON) {
    bend.set(Math.abs(direction.y) < .9 ? 0 : 1, Math.abs(direction.y) < .9 ? 1 : 0, 0);
    bend.addScaledVector(direction, -bend.dot(direction));
  }
  bend.normalize();
  const along = (a * a - b * b + distance * distance) / (2 * distance);
  const elbow = origin.clone().addScaledVector(direction, along)
    .addScaledVector(bend, Math.sqrt(Math.max(0, a * a - along * along)));
  aimBone(root, mid, elbow);
  aimBone(mid, tip, reach);
  if (orientation) setWorldOrientation(tip, orientation);
  return { requested, reached: distance, error: tip.getWorldPosition(new THREE.Vector3()).distanceTo(target) };
}

function aimBone(bone, child, target) {
  bone.updateWorldMatrix(true, true);
  const origin = bone.getWorldPosition(new THREE.Vector3());
  const current = child.getWorldPosition(new THREE.Vector3()).sub(origin).normalize();
  const desired = target.clone().sub(origin).normalize();
  const rotation = new THREE.Quaternion().setFromUnitVectors(current, desired)
    .multiply(bone.getWorldQuaternion(new THREE.Quaternion()));
  setWorldOrientation(bone, rotation);
}

export function setWorldOrientation(bone, orientation) {
  const parent = bone.parent.getWorldQuaternion(new THREE.Quaternion());
  bone.quaternion.copy(parent.invert().multiply(orientation));
  bone.updateWorldMatrix(false, true);
}

/** Orient the upper arm's hinge to the actual bend plane. Preserve the elbow,
 * wrist and palm frame: axial forearm rotation must not become sideways flexion.
 * The rest-frame correction includes the rig's slightly sloping T-pose arms. */
export function alignElbowHinge(upper, forearm, hand) {
  upper.updateWorldMatrix(true,true);
  const origin=upper.getWorldPosition(new THREE.Vector3());
  const elbow=forearm.getWorldPosition(new THREE.Vector3());
  const wrist=hand.getWorldPosition(new THREE.Vector3());
  const u=elbow.clone().sub(origin).normalize(), f=wrist.clone().sub(elbow).normalize();
  const normal=u.clone().cross(f);
  if(normal.lengthSq()<1e-8)return; // No unique plane for a straight arm.
  const sign=Math.sign(forearm.position.x)||1;
  const x=u.multiplyScalar(sign), y=normal.normalize().multiplyScalar(-sign);
  const restX=forearm.position.clone().normalize().multiplyScalar(sign);
  const restY=new THREE.Vector3(0,1,0).addScaledVector(restX,-restX.y).normalize();
  const rest=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(restX,restY,restX.clone().cross(restY)));
  const frame=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x,y,x.clone().cross(y)));
  const palmFrame=forearm.getWorldQuaternion(new THREE.Quaternion());
  setWorldOrientation(upper,frame.multiply(rest.invert()));
  setWorldOrientation(forearm,palmFrame);
}


/** Blade-led arm pose. The forearm carries the grip frame; wrist stays neutral.
 * Reproject the elbow onto the upper-arm sphere instead of bending the wrist
 * to satisfy an unreachable combination of hand position and orientation. */
export function solveWeaponArm(root,mid,hand,target,orientation,weight=1,clearance=null,plane=null){
  root.updateWorldMatrix(true,true);
  const oldRoot=root.quaternion.clone(),oldMid=mid.quaternion.clone();
  const origin=root.getWorldPosition(new THREE.Vector3());
  const upper=mid.position.length(),lower=hand.position.length();
  const direction=hand.position.clone().normalize().applyQuaternion(orientation);
  const upperDirection=target.clone().addScaledVector(direction,-lower).sub(origin).normalize();
  if(clearance){
    const outward=clearance.outward.clone().normalize();
    const minimum=THREE.MathUtils.clamp(clearance.point.clone().sub(origin).dot(outward)/upper,0,.85);
    const component=upperDirection.dot(outward);
    if(component<minimum){
      const tangent=upperDirection.clone().addScaledVector(outward,-component);
      if(tangent.lengthSq()<1e-8)tangent.set(0,-1,0).addScaledVector(outward,outward.y);
      upperDirection.copy(tangent.normalize().multiplyScalar(Math.sqrt(1-minimum*minimum))).addScaledVector(outward,minimum);
    }
  }
  if(plane){
    const n=plane.normal.clone().normalize(),c=THREE.MathUtils.clamp((plane.offset-origin.dot(n))/upper,-.98,.98);
    const tangent=upperDirection.clone().addScaledVector(n,-upperDirection.dot(n));
    if(tangent.lengthSq()<1e-8)tangent.set(0,0,1).addScaledVector(n,-n.z);
    tangent.normalize();const radius=Math.sqrt(1-c*c);
    if(clearance){
      const outward=clearance.outward.clone().normalize(),dot=outward.dot(n);
      const e=outward.clone().addScaledVector(n,-dot),length=e.length();
      const minimum=THREE.MathUtils.clamp(clearance.point.clone().sub(origin).dot(outward)/upper,0,.85);
      if(length>1e-6){
        e.divideScalar(length);const required=THREE.MathUtils.clamp((minimum-c*dot)/(radius*length),-1,1);
        if(tangent.dot(e)<required){const f=n.clone().cross(e),sign=Math.sign(tangent.dot(f))||1;tangent.copy(e).multiplyScalar(required).addScaledVector(f,sign*Math.sqrt(1-required*required));}
      }
    }
    const constrained=n.multiplyScalar(c).addScaledVector(tangent,radius);
    upperDirection.lerp(constrained,plane.weight??1).normalize();
  }
  const elbow=upperDirection.multiplyScalar(upper).add(origin);
  aimBone(root,mid,elbow);setWorldOrientation(mid,orientation);
  root.quaternion.copy(oldRoot.slerp(root.quaternion.clone(),weight));
  mid.quaternion.copy(oldMid.slerp(mid.quaternion.clone(),weight));
  hand.quaternion.identity();root.updateWorldMatrix(false,true);
}
