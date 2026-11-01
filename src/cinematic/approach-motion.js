import {MathUtils} from 'three';

/** Straight approach at 10.6 m/s, timed to reach the crossing before the cut. */
export function carMotionAt(time) {
  return {visible:time>=17,x:1.1,z:-2.4+(Math.max(17,time)-23.3)*10.6,yaw:0};
}

export function avoidanceAt(time) {
  return {notice:MathUtils.smoothstep(time,21.15,21.55),flinch:MathUtils.smoothstep(time,21.7,22.2),step:MathUtils.smoothstep(time,21.75,22.6)};
}
