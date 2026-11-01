/** Shared geography for terrain, water meshes, vegetation and the atlas. Metres. */
export const LAKES=Object.freeze([
  {id:'western-lake',name:'Western lake',x:-490,z:760,rx:170,rz:135,level:-8,depth:12},
  {id:'upland-lake',name:'Upland lake',x:1240,z:760,rx:115,rz:88,level:13,depth:9},
]);
export const RIVERS=Object.freeze([
  {id:'western-river',name:'Western river',depth:3.8,points:[[-850,-1150,28,7],[-730,-910,19,8],[-560,-680,11,10],[-400,-430,6,11],[-265,-220,2,12],[-245,60,0,13],[-380,280,-4,15],[-480,570,-7,16],[-490,720,-8,18]]},
]);
export const MOUNTAINS=Object.freeze([
  {x:-1280,z:-830,rx:480,rz:620,height:215},
  {x:-690,z:-1640,rx:420,rz:320,height:175},
  {x:1280,z:1310,rx:580,rz:430,height:245},
]);
const clamp=t=>Math.max(0,Math.min(1,t));
const smooth=t=>{t=clamp(t);return t*t*(3-2*t);};
const cat=(a,b,c,d,t)=>.5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t);
export const RIVER_SEGMENTS=[];
for(const river of RIVERS){
  const p=river.points;let prior=null;
  for(let i=0;i<p.length-1;i++)for(let j=0;j<=16;j++){
    const t=j/16,a=p[Math.max(0,i-1)],b=p[i],c=p[i+1],d=p[Math.min(p.length-1,i+2)];
    const point={x:cat(a[0],b[0],c[0],d[0],t),z:cat(a[1],b[1],c[1],d[1],t),level:b[2]+(c[2]-b[2])*t,width:b[3]+(c[3]-b[3])*t};
    if(prior&&(point.x!==prior.x||point.z!==prior.z))RIVER_SEGMENTS.push({a:prior,b:point,river});prior=point;
  }
}
const cells=new Map(),cellSize=96;
for(const seg of RIVER_SEGMENTS){const r=Math.max(seg.a.width,seg.b.width)+38;
  for(let z=Math.floor((Math.min(seg.a.z,seg.b.z)-r)/cellSize);z<=Math.floor((Math.max(seg.a.z,seg.b.z)+r)/cellSize);z++)for(let x=Math.floor((Math.min(seg.a.x,seg.b.x)-r)/cellSize);x<=Math.floor((Math.max(seg.a.x,seg.b.x)+r)/cellSize);x++){
    const key=x+':'+z;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(seg);
  }
}
export function mountainHeight(x,z){
  let h=0;
  for(const m of MOUNTAINS){const dx=(x-m.x)/m.rx,dz=(z-m.z)/m.rz,r=Math.hypot(dx,dz);if(r>=1)continue;
    const ridge=.76+.24*(1-Math.abs(Math.sin(dx*5.4+dz*3.2+Math.sin(dz*4)*.7)));
    h=Math.max(h,m.height*(1-smooth(r))**1.35*ridge);
  }return h;
}
/** Signed shore distance: negative underwater, positive on the bank. */
export function waterSample(x,z){
  let best=null;
  for(const lake of LAKES){
    const r=Math.hypot((x-lake.x)/lake.rx,(z-lake.z)/lake.rz),shore=(r-1)*Math.min(lake.rx,lake.rz);
    if(shore<38&&(!best||shore<best.shore))best={id:lake.id,shore,level:lake.level,depth:lake.depth,ratio:r,flowX:0,flowZ:0,type:'lake'};
  }
  for(const {a,b,river}of cells.get(Math.floor(x/cellSize)+':'+Math.floor(z/cellSize))??[]){
    const dx=b.x-a.x,dz=b.z-a.z,len2=dx*dx+dz*dz,t=clamp(((x-a.x)*dx+(z-a.z)*dz)/len2),width=a.width+(b.width-a.width)*t;
    const distance=Math.hypot(x-a.x-dx*t,z-a.z-dz*t),shore=distance-width;
    if(shore>38||best&&shore>=best.shore)continue;
    best={id:river.id,shore,level:a.level+(b.level-a.level)*t,depth:river.depth,ratio:distance/width,flowX:dx/Math.sqrt(len2),flowZ:dz/Math.sqrt(len2),type:'river'};
  }return best;
}
export function watershedHeight(x,z,height){
  const w=waterSample(x,z);if(!w)return height;
  if(w.shore<=0)return w.level+.08-w.depth*Math.max(0,1-w.ratio*w.ratio);
  const bank=w.level+.08+w.shore*.16;
  return bank+(height-bank)*smooth(w.shore/38);
}
export const isWater=(x,z,margin=0)=>{const w=waterSample(x,z);return Boolean(w&&w.shore<margin);};
