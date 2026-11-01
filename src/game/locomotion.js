import * as THREE from 'three';
const {lerp,smoothstep}=THREE.MathUtils;

// Separate authored cycles. Phase 0 is left contact; phase .5 is right contact.
// Sources and pose rationale: docs/locomotion-cycles.md.
export const GAITS=Object.freeze({
  walk:{distance:1.14,stance:.60,front:.27,back:-.414,
    pelvis:[[0,-.075],[.15,-.090],[.50,-.008],[.76,.006],[1,-.075]],
    swing:[[.60,-.414,.175,.55],[.70,-.28,.22,.40],[.82,.03,.23,-.08],[.93,.23,.17,-.20],[1,.27,.134,-.15]],
  },
  run:{distance:2.496,stance:.24,front:.24,back:-.35904,
    pelvis:[[0,-.045],[.20,-.080],[.52,.010],[.64,.065],[.80,.095],[1,-.045]],
    swing:[[.24,-.35904,.176,.65],[.32,-.55872,.42,.75],[.45,-.48,.68,.95],[.64,-.16,.64,.50],[.80,.27,.47,-.10],[.92,.32,.30,-.18],[1,.24,.13,0]],
  },
});

export function curve(keys,t,column=1){
  for(let i=1;i<keys.length;i++)if(t<=keys[i][0]){
    const a=keys[i-1],b=keys[i];return lerp(a[column],b[column],smoothstep(t,a[0],b[0]));
  }
  return keys.at(-1)[column];
}

export function sampleGait(kind,phase){
  const gait=GAITS[kind],cycle=((phase%1)+1)%1;
  const feet={};
  for(const [side,offset]of [['L',0],['R',.5]]){
    const t=(cycle+offset)%1;
    let z,y,pitch;
    if(t<gait.stance){
      z=lerp(gait.front,gait.back,t/gait.stance); // Constant ground velocity.
      if(kind==='walk'){
        const push=smoothstep(t,.26,.55);
        pitch=lerp(-.15,0,smoothstep(t,0,.08))+.55*push;
      }else{
        const push=smoothstep(t,.16,.32);
        pitch=.65*smoothstep(t,.12,.24);
      }
      y=.13*Math.cos(pitch)+(pitch>0?.12:-.04)*Math.sin(pitch);
    }else{
      z=curve(gait.swing,t,1);y=curve(gait.swing,t,2);pitch=curve(gait.swing,t,3);
    }
    feet[side]={z,y,pitch,contact:t<gait.stance,phase:t};
  }
  const angle=cycle*Math.PI*2;
  return {feet,pelvisY:curve(gait.pelvis,(cycle*2)%1),
    pelvisX:Math.sin(angle)*(kind==='walk'?.024:.015),
    roll:Math.sin(angle)*(kind==='walk'?.035:.025),
    twist:-Math.cos(angle)*(kind==='walk'?.075:.12),
    lean:kind==='run'?.11:.018,
    airborne:!feet.L.contact&&!feet.R.contact};
}

export function blendGaits(phase,weight){
  const a=sampleGait('walk',phase),b=sampleGait('run',phase),result={feet:{}};
  for(const key of ['pelvisY','pelvisX','roll','twist','lean'])result[key]=lerp(a[key],b[key],weight);
  for(const side of ['L','R']){
    result.feet[side]={};for(const key of ['z','y','pitch'])result.feet[side][key]=lerp(a.feet[side][key],b.feet[side][key],weight);
    result.feet[side].contact=weight<.5?a.feet[side].contact:b.feet[side].contact;
  }
  return result;
}
