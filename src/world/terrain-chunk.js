import {terrainHeight} from './terrain.js';
import {roadEdgeDistance} from './layout.js';
import {waterSample} from './watersheds.js';

/** Shared by initial loading and the streaming worker. Grid vertices are exact
 * world coordinates, so neighbouring chunks always meet at identical edges. */
export function sampleTerrainChunk(cx,cz,size=80,segments=64){
  const count=(segments+1)**2,heights=new Float32Array(count),roads=new Float32Array(count),banks=new Float32Array(count);
  for(let iz=0;iz<=segments;iz++)for(let ix=0;ix<=segments;ix++){
    const i=iz*(segments+1)+ix,x=cx-size/2+ix*size/segments,z=cz-size/2+iz*size/segments;
    heights[i]=terrainHeight(x,z);roads[i]=Math.max(0,Math.min(1,(1.6-roadEdgeDistance(x,z))/3));
    const w=waterSample(x,z),t=Math.max(0,Math.min(1,(w?.shore??100)/12));banks[i]=w?1-t*t*(3-2*t):0;
  }
  return {heights,roads,banks};
}
