import * as THREE from 'three';
const {lerp,smoothstep}=THREE.MathUtils;
const q=(x,y,z)=>new THREE.Quaternion().setFromEuler(new THREE.Euler(x,y,z));

/** FK swing: shoulder drives the pendulum; elbow and wrist lag behind it. */
export function locomotionArm(side,phase,run,motion){
  const offset=side==='L'?0:Math.PI;
  const angle=phase*Math.PI*2+offset;
  const shoulder=.08-Math.cos(angle-.12)*lerp(.30,.65,run)*motion;
  const elbow=lerp(.25+.18*(1-Math.cos(angle-.42))*.5,1.30+.16*Math.sin(angle-.28),run)*motion+.30*(1-motion);
  return {shoulder,elbow,spread:.12+.025*motion*Math.sin(angle-.2)**2,
    sweep:0,wrist:Math.sin(angle-.65)*lerp(.06,.035,run)*motion};
}

// Shoulder pitch, elbow bend, arm sweep. Wrist is deliberately NOT a blade aim control.
const CUTS=[
  [[0,-.10,1.10,0],[.24,1.70,1.30,-.45],[.33,1.72,1.24,-.45],[.48,.83,.25,.10],[.64,.04,.20,.58],[1,-.10,1.10,0]],
  [[0,-.10,1.10,0],[.24,.85,1.30,.70],[.33,.90,1.25,.70],[.48,.78,.28,-.08],[.64,.14,.20,-.65],[1,-.10,1.10,0]],
];
// Monotone cubic interpolation preserves speed through the strike while avoiding
// overshoot. Flat anticipation keys still hold; impact keys no longer stop dead.
function flowingCurve(keys,p,column){
  let i=1;while(i<keys.length-1&&p>keys[i][0])i++;
  const a=keys[i-1],b=keys[i],h=b[0]-a[0],t=THREE.MathUtils.clamp((p-a[0])/h,0,1);
  const slope=n=>{
    if(n===0||n===keys.length-1)return 0;
    const left=(keys[n][column]-keys[n-1][column])/(keys[n][0]-keys[n-1][0]);
    const right=(keys[n+1][column]-keys[n][column])/(keys[n+1][0]-keys[n][0]);
    return left*right>0?2*left*right/(left+right):0;
  };
  return (2*t**3-3*t*t+1)*a[column]+(t**3-2*t*t+t)*h*slope(i-1)
    +(-2*t**3+3*t*t)*b[column]+(t**3-t*t)*h*slope(i);
}
export function swordArm(progress,combo=0,height=1.25){
  const keys=CUTS[combo%CUTS.length],p=THREE.MathUtils.clamp(progress,0,1);
  const delayed=p-.018*Math.sin(Math.PI*p);
  return {shoulder:flowingCurve(keys,p,1)+THREE.MathUtils.clamp(height-1.25,-.25,.2)*Math.sin(Math.PI*p)*.5,
    elbow:flowingCurve(keys,delayed,2),sweep:flowingCurve(keys,p,3),spread:.12,wrist:0};
}
export function applyArmFK(bones,side,pose,weight=1){
  const s=side==='L'?1:-1;
  const upper=q(0,pose.sweep??0,0).multiply(q(-pose.shoulder,0,0)).multiply(q(0,0,-s*(Math.PI/2-pose.spread)));
  const fore=q(0,-s*pose.elbow,0),hand=q(0,-s*(pose.wrist??0),0);
  bones[`upperArm${side}`].quaternion.slerp(upper,weight);
  bones[`forearm${side}`].quaternion.slerp(fore,weight);
  bones[`hand${side}`].quaternion.slerp(hand,weight);
}
