import * as THREE from 'three';

/** Distance between finite segments, including degenerate points. */
export function segmentDistance(p1, q1, p2, q2) {
  const d1=q1.clone().sub(p1), d2=q2.clone().sub(p2), r=p1.clone().sub(p2);
  const a=d1.dot(d1), e=d2.dot(d2), f=d2.dot(r), eps=1e-10;
  let s=0,t=0;
  if(a<=eps&&e<=eps)return p1.distanceTo(p2);
  if(a<=eps)t=THREE.MathUtils.clamp(f/e,0,1);
  else {
    const c=d1.dot(r);
    if(e<=eps)s=THREE.MathUtils.clamp(-c/a,0,1);
    else {
      const b=d1.dot(d2), denominator=a*e-b*b;
      if(denominator>eps)s=THREE.MathUtils.clamp((b*f-c*e)/denominator,0,1);
      t=(b*s+f)/e;
      if(t<0){t=0;s=THREE.MathUtils.clamp(-c/a,0,1);}
      else if(t>1){t=1;s=THREE.MathUtils.clamp((b-c)/a,0,1);}
    }
  }
  return p1.clone().addScaledVector(d1,s).distanceTo(p2.clone().addScaledVector(d2,t));
}

export class WeaponContact {
  constructor(markers) { this.markers=markers; this.previous=null; this.action=null; this.hitTargets=new Set(); }
  update(action, targets, onHit) {
    const base=this.markers.bladeBase.getWorldPosition(new THREE.Vector3());
    const tip=this.markers.bladeTip.getWorldPosition(new THREE.Vector3());
    if(action!==this.action){this.action=action;this.hitTargets.clear();this.previous=null;}
    const previous=this.previous??{base,tip,progress:action?.progress??0};
    if(action?.kind==='sword'&&action.progress>=.29&&previous.progress<=.66) {
      for(const target of targets) {
        if(target.hp<=0||this.hitTargets.has(target))continue;
        const low=target.position.clone().add(new THREE.Vector3(0,.35,0));
        const high=target.position.clone().add(new THREE.Vector3(0,target.height+.25,0));
        const delta=action.progress-previous.progress;
        const start=delta>0?THREE.MathUtils.clamp((.29-previous.progress)/delta,0,1):0;
        const end=delta>0?THREE.MathUtils.clamp((.66-previous.progress)/delta,0,1):1;
        for(let step=0;step<=12;step++) {
          const t=THREE.MathUtils.lerp(start,end,step/12);
          const a=previous.base.clone().lerp(base,t),b=previous.tip.clone().lerp(tip,t);
          if(segmentDistance(a,b,low,high)<.25){this.hitTargets.add(target);onHit(target);break;}
        }
      }
    }
    this.previous={base,tip,progress:action?.progress??0};
  }
}
