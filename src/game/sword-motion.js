import {MathUtils,Vector3} from 'three';

export const SWORD_CUT_COUNT=2;
export const SWORD_IMPACT=.43;
export const SWORD_DURATION=.78;

/** Two cuts in one horizontal plane, in character space (+Z faces the target).
 * A double-edged blade keeps the same palm roll on the returning backhand.
 * The hand never rotates independently to chase a point on the arc. */
export function sampleSwordCut(progress,combo=0,height=1.25,power=0){
  const {smoothstep,lerp,clamp}=MathUtils;
  const direction=combo%SWORD_CUT_COUNT===0?1:-1;
  const travel=smoothstep(progress,.25,.61);
  const weight=smoothstep(progress,0,.24)*(1-smoothstep(progress,.68,1));
  const angle=direction*lerp(-1.05-power*.12,1.05+power*.12,travel);
  const planeHeight=clamp(height,1.08,1.36);
  return {
    direction,weight,travel,planeHeight,
    blade:new Vector3(Math.sin(angle),0,Math.cos(angle)),
    edge:new Vector3(-Math.cos(angle),0,Math.sin(angle)),
    wrist:new Vector3(lerp(-.26,-.04,(angle+1.17)/2.34),planeHeight,.43),
    turn:direction*lerp(-.22,.28,travel)*weight,
  };
}
