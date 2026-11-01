import {MathUtils} from 'three';

const WALK=[0,.5,.75,.25];
// Front left/right, hind left/right. Four contacts followed by suspension.
const GALLOP=[-.12,.73,.25,.09];
export const horseRunBlend=speed=>MathUtils.smoothstep(speed,4,7);
export const horseStride=speed=>MathUtils.lerp(2.6,4.8,horseRunBlend(speed));
export const horseLegOffsets=speed=>WALK.map((phase,i)=>MathUtils.lerp(phase,GALLOP[i],horseRunBlend(speed)));
export const horseHoofContacts=speed=>horseLegOffsets(speed).map((phase,leg)=>({phase:MathUtils.euclideanModulo(.25-phase,1),leg,weight:leg<2?1:.78}));
