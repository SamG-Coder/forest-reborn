import {CAMPAIGN_SITE,ASHHOLD,MUSTER_CAMPS} from './battle-sites.js';
import {CAMP_DEFINITIONS} from './camp-director.js';
import {TOWN_PLOTS,roadEdgeDistance} from './layout.js';
import {HIGHMERE,HIGHMERE_PLOTS,HIGHMERE_ROADS,KEEP_FOOTPRINTS,WARFRONT,inHighmere} from './region-layout.js';
import {createRoadGrading} from './road-grading.js';
import {mountainHeight,watershedHeight,isWater,LAKES} from './watersheds.js';
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
  HIGHMERE,ASHHOLD,CAMPAIGN_SITE,...LAKES,
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
  // A broad graded town site, with a separate knoll behind the market. The
  // former tight hill and sinusoidal base created shelves beside each street.
  const base=naturalHeight(HIGHMERE.x,HIGHMERE.z)+1.4+dx*.008-dz*.004;
  const northRise=smooth((-dz-28)/78);
  const hill=7*northRise*(1-smooth((Math.abs(dx+12)-45)/130));
  return base+hill;
}

function landscapeHeight(x,z){
  let height=watershedHeight(x,z,naturalHeight(x,z)+mountainHeight(x,z));
  const fortRadius=Math.hypot(x-ASHHOLD.x,z-ASHHOLD.z);
  if(fortRadius<200){
    const hill=naturalHeight(ASHHOLD.x,ASHHOLD.z)+18;
    height+=(hill-height)*(1-smooth((fortRadius-55)/145));
  }
  // Wide, round transition: the old 30 m rectangular border cut a trench around town.
  const radius=Math.hypot((x-HIGHMERE.x)/147,(z-HIGHMERE.z+8)/153);
  if(radius<2.35){height+=(cityHeight(x,z)-height)*(1-smooth((radius-.92)/1.43));
    const top=cityHeight(HIGHMERE.x-12,HIGHMERE.z-80)-.25;
    for(const pad of KEEP_FOOTPRINTS){const dx=x-HIGHMERE.x-pad.x,dz=z-HIGHMERE.z-pad.z;
      const outside=pad.r?Math.max(0,Math.hypot(dx,dz)-pad.r-.6):Math.hypot(Math.max(0,Math.abs(dx)-pad.w/2-.6),Math.max(0,Math.abs(dz)-pad.d/2-.6));
      if(outside<22)height+=(top-height)*(1-smooth(outside/22));
    }
    for(const pad of HIGHMERE_PLOTS){const dx=x-pad.x,dz=z-pad.z,c=Math.cos(pad.angle??0),s=Math.sin(pad.angle??0);
      const outside=Math.hypot(Math.max(0,Math.abs(dx*c-dz*s)-pad.w/2-.6),Math.max(0,Math.abs(dx*s+dz*c)-pad.d/2-.6));if(outside<18)height+=(cityHeight(pad.x,pad.z)-height)*(1-smooth(outside/18));}
  }
  for(const pad of PADS){
    const outside=Math.hypot(Math.max(0,Math.abs(x-pad.x)-pad.w/2-.65),Math.max(0,Math.abs(z-pad.z)-pad.d/2-.65));
    if(outside<3.5){const weight=1-smooth(outside/3.5);height+=(naturalHeight(pad.x,pad.z)-height)*weight;}
  }
  return height;
}
const roadGrading=createRoadGrading(HIGHMERE_ROADS,landscapeHeight);
// Building floors are part of the final terrain contract, after road grading.
// Store their centre levels once so geometry, sleepers and terrain agree.
const buildingPads=[...TOWN_PLOTS,...HIGHMERE_PLOTS].map(p=>({...p,c:Math.cos(p.angle??0),s:Math.sin(p.angle??0),level:roadGrading.height(p.x,p.z,landscapeHeight(p.x,p.z))}));
/** Geometry, movement, vegetation and maps query exactly the same final surface. */
export function terrainHeight(x,z){
  let height=roadGrading.height(x,z,landscapeHeight(x,z));
  let padBlend=0,padSum=0,padWeight=0,insidePad=null,nearestPad=100;
  for(const p of buildingPads){
    if(Math.abs(x-p.x)>p.w+p.d+12||Math.abs(z-p.z)>p.w+p.d+12)continue;
    const dx=x-p.x,dz=z-p.z,lx=dx*p.c-dz*p.s,lz=dx*p.s+dz*p.c;
    const outside=Math.hypot(Math.max(0,Math.abs(lx)-p.w/2-.4),Math.max(0,Math.abs(lz)-p.d/2-.4));
    nearestPad=Math.min(nearestPad,outside);
    if(outside===0){insidePad=p;break;}
    if(outside<18){const blend=1-smooth(outside/18),w=blend/Math.max(.01,outside*outside);padBlend=Math.max(padBlend,blend);padSum+=p.level*w;padWeight+=w;}
  }
  if(insidePad)height=insidePad.level;else if(padWeight)height+=(padSum/padWeight-height)*padBlend;
  // The road owns its carriageway after house grading. Fade its influence out
  // at doorsteps, leaving the exact floor level inside each building intact.
  if(!insidePad)height+=(roadGrading.height(x,z,height)-height)*smooth(nearestPad/4);
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
  if(isWater(x,z,3)||mountainHeight(x,z)>48)return false;
  if(Math.hypot(x-ASHHOLD.x,z-ASHHOLD.z)<90)return false;
  if(inTown(x,z)||inHighmere(x,z,5)||roadDistance(x,z)<5)return false;
  // Only the camp's occupied footprint is cleared. Combat never removes trees.
  if(CAMP_DEFINITIONS.some(c=>Math.hypot(x-c.x,z-c.z)<9.5))return false;
  if(MUSTER_CAMPS.some(c=>Math.abs(x-c.x)<17&&Math.abs(z-c.z)<13))return false;
  return !LANDMARKS.some(mark=>!mark.radius&&mark.id!==WARFRONT.id&&Math.hypot(x-mark.x,z-mark.z)<(mark.id==='town'?40:14));
}
export function clampToWorld(position){
  position.x=Math.max(-WORLD_HALF+.5,Math.min(WORLD_HALF-.5,position.x));
  position.z=Math.max(-WORLD_HALF+.5,Math.min(WORLD_HALF-.5,position.z));
  return position;
}
