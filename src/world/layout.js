import {regionRoadDistance} from './region-layout.js';
/** One layout owns building footprints, entrances and roads. NPC routes use the same obstacles. */
export const TOWN_PLOTS=Object.freeze([
  {id:'stables',name:'MOSSWAKE STABLES',workshop:true,wallMaterial:'siding',x:-31,z:35,w:12,d:10,h:3.6,angle:Math.PI,tint:1},
  {id:'tavern',x:-19,z:-19,w:16,d:13,h:4.1,name:'THE WAYWARD OAK',tavern:true,tint:0},
  {id:'stores',x:19,z:-19,w:11,d:11,h:4.6,name:'MOSSWAKE STORES',tint:1,wallMaterial:'siding'},
  {id:'apothecary',x:-22,z:15,w:10,d:10,h:3.3,name:'APOTHECARY',workshop:true,roofMaterial:'clay',angle:Math.PI,tint:2},
  {id:'smith',x:23,z:16,w:11,d:10,h:3.8,name:'SMITH & LEATHER',workshop:true,wallMaterial:'brick',roofMaterial:'clay',angle:-Math.PI/2,tint:3},
  {id:'watch',x:22,z:-38,w:9,d:9,h:5.4,name:'WATCH HOUSE',wallMaterial:'brick',angle:-Math.PI/2,tint:1},
  {id:'cottage-west',name:'WEAVER',workshop:true,wallMaterial:'siding',x:-37,z:-6,w:8,d:7,h:3.1,angle:Math.PI/2,tint:3,lean:true},
  {id:'cottage-north',x:-37,z:-30,w:9,d:8,h:3.7,angle:.3,tint:2},
  {id:'cottage-garden',x:-36,z:19,w:8,d:8,h:3.4,angle:Math.PI/2,tint:1,lean:true},
  {id:'cottage-east',name:'CARPENTER',workshop:true,x:38,z:-15,w:9,d:8,h:3.7,angle:-Math.PI/2,tint:0,lean:true},
  {id:'cottage-lane',wallMaterial:'siding',roofMaterial:'clay',x:38,z:3,w:8,d:7,h:3.0,angle:-Math.PI/2,tint:2},
  {id:'cottage-south',roofMaterial:'clay',x:-12,z:35,w:8,d:7,h:3.2,angle:Math.PI,tint:0},
  {id:'cottage-orchard',x:12,z:37,w:9,d:8,h:3.9,angle:Math.PI,tint:3,lean:true},
]);

const roads=[
  {width:2.8,points:[[-1,23],[-17,26],[-24,27],[-31,28.9]]},
  {width:5.5,points:[[0,85],[2,42],[-1,20],[-2,9],[3,-5],[0,-24],[0,-45],[4,-83]]},
  {width:3.5,points:[[-46,-3],[-31,-1],[-17,0],[-8,1],[3,-5],[16,-5],[33,-2],[49,0]]},
  {width:3.2,points:[[-10,5],[-8,-4],[0,-7],[11,-5],[15,5],[4,12],[-10,5]]},
  {width:2.8,points:[[-1,-7],[-9,-9],[-19,-11.7]]},
  {width:2.5,points:[[12,-5],[18,-9],[19,-12.8]]},
  {width:2.6,points:[[-19,0],[-21,4],[-22,9.2]]},
  {width:2.7,points:[[9,10],[14,14],[17.5,16]]},
  {width:2.4,points:[[0,-33],[9,-35],[17,-38]]},
  {width:2.0,points:[[-30,0],[-30,-13],[-34,-22],[-35.5,-25.5]]},
  {width:1.8,points:[[-31,-1],[-32,-6],[-33,-6]]},
  {width:1.9,points:[[-29,2],[-30,14],[-31.5,19]]},
  {width:2.0,points:[[31,-2],[32,-9],[33.5,-15]]},
  {width:1.8,points:[[32,-1],[32,3],[34,3]]},
  {width:2.3,points:[[-1,23],[-7,28],[-12,30.7]]},
  {width:2.3,points:[[1,27],[7,31],[12,32.5]]},
];
function curve(points){
  const out=[];
  for(let i=0;i<points.length-1;i++){
    const a=points[Math.max(0,i-1)],b=points[i],c=points[i+1],d=points[Math.min(points.length-1,i+2)];
    const steps=Math.ceil(Math.hypot(c[0]-b[0],c[1]-b[1])/2);
    for(let j=0;j<steps;j++){const t=j/steps;out.push([0,1].map(k=>.5*((2*b[k])+(-a[k]+c[k])*t+(2*a[k]-5*b[k]+4*c[k]-d[k])*t*t+(-a[k]+3*b[k]-3*c[k]+d[k])*t*t*t)));}
  }out.push(points.at(-1));return out;
}
export const ROAD_PATHS=roads.map(road=>({...road,points:curve(road.points)}));
const segments=ROAD_PATHS.flatMap(r=>r.points.slice(1).map((b,i)=>({a:r.points[i],b,width:r.width})));
export function roadEdgeDistance(x,z){
  if(x<-70||x>70||z<-110||z>110)return regionRoadDistance(x,z);
  let nearest=100;
  for(const {a,b,width} of segments){
    const dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1)));
    nearest=Math.min(nearest,Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz)-width/2);
  }
  // The market is a worn, irregular small square, not another building-sized road.
  return Math.min(nearest,Math.hypot((x-2)*.9,z-2)-7.5,regionRoadDistance(x,z));
}
