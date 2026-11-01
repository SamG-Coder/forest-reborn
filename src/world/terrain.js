import {TOWN_PLOTS,roadEdgeDistance} from './layout.js';
import {HIGHMERE,HIGHMERE_PLOTS,HIGHMERE_ROADS,KEEP_FOOTPRINTS,WARFRONT,inHighmere} from './region-layout.js';
import {createRoadGrading} from './road-grading.js';
export {TOWN_PLOTS} from './layout.js';
export const WORLD_SIZE = 4000;
export const WORLD_HALF = WORLD_SIZE / 2;
export const CHUNK_SIZE = 80;
export const TOWN_BOUNDS = Object.freeze({minX:-46,maxX:46,minZ:-48,maxZ:42});
export const LANDMARKS = Object.freeze([
  {id:'town',name:'Mosswake',x:0,z:0},
  {id:'meadow',name:'South meadow',x:65,z:70},
  {id:'goblins',name:'Briar grove',x:85,z:-85},
  {id:'bandits',name:'Old cart road',x:-100,z:-110},
  {id:'quarry',name:'Old quarry',x:115,z:-92},
  {id:'east-camp',name:'East-road camp',x:105,z:-16},
  {id:'sheep',name:'Sheep pasture',x:33,z:35},
  {id:'ridge',name:'North ridge',x:200,z:-420},
  {id:'highmere-keep',name:'Highmere keep',x:838,z:-930},
  {id:'highmere-oak',name:'The old oak',x:800,z:-829},
  HIGHMERE,WARFRONT,
]);
export function random(seed){return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
export function chunkSeed(x,z){return (Math.imul(x+1000,73856093)^Math.imul(z+1000,19349663)^1184)>>>0;}
const smooth = value => {const x=Math.max(0,Math.min(1,value));return x*x*(3-2*x);};

const PADS=[...TOWN_PLOTS.map(p=>({...p,w:Math.abs(Math.cos(p.angle??0))*p.w+Math.abs(Math.sin(p.angle??0))*p.d,d:Math.abs(Math.sin(p.angle??0))*p.w+Math.abs(Math.cos(p.angle??0))*p.d})),{x:11,z:2,w:6,d:6},{x:-10,z:3,w:6,d:6},{x:0,z:-12,w:5,d:5},{x:0,z:-45,w:18,d:4},
  {x:23,z:24,w:12,d:5},{x:-22,z:23,w:10,d:4}];
function naturalHeight(x,z){
  return Math.sin(x*.018)*2.8+Math.sin(z*.024)*1.8+Math.sin((x+z)*.010)*2+
    smooth((Math.hypot(x,z)-110)/210)*(Math.sin(x*.006)*Math.cos(z*.005)*22+Math.sin(x*.016+z*.009)*5);
}
function cityHeight(x,z){
  const dx=x-HIGHMERE.x,dz=z-HIGHMERE.z;
  const base=naturalHeight(HIGHMERE.x,HIGHMERE.z)+Math.sin(dx*.017)*1.9+Math.cos(dz*.024)*1.4;
  const radius=Math.hypot((dx+12)/85,(dz+76)/80);
  return base+17*(1-smooth((radius-.30)/.85));
}

function landscapeHeight(x,z){
  let height=naturalHeight(x,z);
  // Wide, round transition: the old 30 m rectangular border cut a trench around town.
  const radius=Math.hypot((x-HIGHMERE.x)/147,(z-HIGHMERE.z+8)/153);
  if(radius<2.35){height+=(cityHeight(x,z)-height)*(1-smooth((radius-.92)/1.43));
    const top=cityHeight(HIGHMERE.x-12,HIGHMERE.z-80)-.25;
    for(const pad of KEEP_FOOTPRINTS){const dx=x-HIGHMERE.x-pad.x,dz=z-HIGHMERE.z-pad.z;
      const outside=pad.r?Math.max(0,Math.hypot(dx,dz)-pad.r-.6):Math.hypot(Math.max(0,Math.abs(dx)-pad.w/2-.6),Math.max(0,Math.abs(dz)-pad.d/2-.6));
      if(outside<12)height+=(top-height)*(1-smooth(outside/12));
    }
    for(const pad of HIGHMERE_PLOTS){const dx=x-pad.x,dz=z-pad.z,c=Math.cos(pad.angle??0),s=Math.sin(pad.angle??0);
      const outside=Math.hypot(Math.max(0,Math.abs(dx*c-dz*s)-pad.w/2-.6),Math.max(0,Math.abs(dx*s+dz*c)-pad.d/2-.6));if(outside<7)height+=(cityHeight(pad.x,pad.z)-height)*(1-smooth(outside/7));}
  }
  for(const pad of PADS){
    const outside=Math.hypot(Math.max(0,Math.abs(x-pad.x)-pad.w/2-.65),Math.max(0,Math.abs(z-pad.z)-pad.d/2-.65));
    if(outside<3.5){const weight=1-smooth(outside/3.5);height+=(naturalHeight(pad.x,pad.z)-height)*weight;}
  }
  return height;
}
const roadGrading=createRoadGrading(HIGHMERE_ROADS,landscapeHeight);
/** Geometry, movement, vegetation and maps query exactly the same final surface. */
export function terrainHeight(x,z){
  let height=roadGrading.height(x,z,landscapeHeight(x,z));
  if(Math.abs(x-HIGHMERE.x)<48&&Math.abs(z-HIGHMERE.z+80)<36){
    const top=cityHeight(HIGHMERE.x-12,HIGHMERE.z-80)-.25;
    for(const pad of KEEP_FOOTPRINTS){const dx=x-HIGHMERE.x-pad.x,dz=z-HIGHMERE.z-pad.z;
      const outside=pad.r?Math.max(0,Math.hypot(dx,dz)-pad.r):Math.hypot(Math.max(0,Math.abs(dx)-pad.w/2),Math.max(0,Math.abs(dz)-pad.d/2));
      if(outside<1.5)height+=(top-height)*(1-smooth(outside/1.5));
    }
  }
  return height;
}
export function inTown(x,z,margin=0){return x>TOWN_BOUNDS.minX-margin&&x<TOWN_BOUNDS.maxX+margin&&z>TOWN_BOUNDS.minZ-margin&&z<TOWN_BOUNDS.maxZ+margin;}
export function roadDistance(x,z){
  return Math.max(0,roadEdgeDistance(x,z)+2.5);
}
export function clearForFoliage(x,z){
  if(inTown(x,z)||inHighmere(x,z,5)||Math.hypot(x-WARFRONT.x,z-WARFRONT.z)<120||roadDistance(x,z)<5)return false;
  return !LANDMARKS.some(mark=>Math.hypot(x-mark.x,z-mark.z)<(mark.id==='town'?40:14));
}
export function clampToWorld(position){
  position.x=Math.max(-WORLD_HALF+.5,Math.min(WORLD_HALF-.5,position.x));
  position.z=Math.max(-WORLD_HALF+.5,Math.min(WORLD_HALF-.5,position.z));
  return position;
}
