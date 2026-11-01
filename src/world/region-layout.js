// World-space definitions are cheap. Geometry and actors live in lazy zone factories.
export const HIGHMERE = Object.freeze({id:'highmere',name:'Highmere',x:850,z:-850,enter:300,leave:390});
export const WARFRONT = Object.freeze({id:'highmere-field',name:'Highmere east field',x:1260,z:-831,enter:180,leave:250});
export const HIGHMERE_WALL=Object.freeze([[0,110],[45,105],[87,80],[112,40],[116,19],[108,-25],[83,-78],[28,-117],[-20,-126],[-77,-103],[-110,-61],[-123,-10],[-119,41],[-91,88],[-43,106]]);
export const HIGHMERE_GATES=Object.freeze([0,4]);
export function inKeepHall(x,z){return x>823.5&&x<852.5&&z>-941&&z<-918;}
export const KEEP_FOOTPRINTS=Object.freeze([
  {x:-12,z:-80,w:31,d:24},{x:8,z:-65,w:10,d:16},
  {x:-29,z:-84,r:7.5},{x:4,z:-86,r:4.8},{x:-26,z:-65,r:3.6},
]);
const plot=(id,name,x,z,w,d,h=5,extra={})=>({id,name,x:HIGHMERE.x+x,z:HIGHMERE.z+z,w,d,h,tint:(Math.abs(x)+Math.abs(z))%4,...extra});
export const HIGHMERE_PLOTS = Object.freeze([
  plot('highmere-guild','ADVENTURERS GUILD',-31,-10,23,17,7,{workshop:true,wallMaterial:'brick',angle:.08}),
  plot('highmere-inn','THE LANTERN HOUSE',32,40,20,15,5.4,{tavern:true,angle:-.12}),
  plot('highmere-smith','THE HIGH FORGE',-32,35,17,14,4.8,{workshop:true,wallMaterial:'brick',roofMaterial:'clay'}),
  plot('highmere-tailor','NEEDLE & THREAD',35,-8,15,13,4.6,{workshop:true,wallMaterial:'siding'}),
  plot('highmere-stores','CARAVAN EXCHANGE',-34,70,17,12,5,{workshop:true,angle:Math.PI}),
  plot('highmere-records','RECORDS & CHARTS',34,-52,17,13,6,{workshop:true}),
  ...[-78,-59,59,80].flatMap((x,col)=>[-53,-3,49].map((z,row)=>plot(`highmere-home-${col}-${row}`,'',x+(row%2)*2,z+(col%2)*3,11+(row%2)*2,12,4+(col%3),{angle:[-.15,.06,.18,-.08][col],wallMaterial:col%2?'siding':undefined,roofMaterial:row%2?'clay':undefined}))),
  ...[-73,-51,48,69].map((x,i)=>plot(`highmere-home-south-${i}`,'',x,76+(i%2)*3,12,10,4.7,{angle:Math.PI+(i-1.5)*.09})),
]);
export const HIGHMERE_ROADS = Object.freeze([
  {width:9,points:[[850,-722],[850,-740],[850,-745],[850,-812],[850,-821],[858,-826],[858,-838],[850,-844],[850,-882]]},
  {width:5.5,points:[[850,-882],[830,-882],[810,-889],[810,-899],[819,-906],[838,-906],[838,-915]]},
  {width:7,points:[[749,-831],[812,-831],[840,-831],[842,-840],[858,-840],[867,-831],[915,-831],[960,-831],[1120,-831],[1260,-831]]},
  {width:6,points:[[770,-882],[810,-882],[850,-882],[890,-882],[928,-882]]},
  {width:6,points:[[770,-788],[811,-788],[850,-788],[889,-788],[930,-788]]},
  {width:4,points:[[805,-780],[805,-831],[805,-890]]},
  {width:4,points:[[895,-780],[895,-831],[895,-890]]},
  {width:5,points:[[4,-83],[55,-160],[190,-295],[380,-430],[590,-600],[760,-680],[815,-694],[838,-710],[850,-722]]},
]);
export function inHighmere(x,z,margin=0) {
  x-=HIGHMERE.x;z-=HIGHMERE.z;let inside=false;
  for(let i=0,j=HIGHMERE_WALL.length-1;i<HIGHMERE_WALL.length;j=i++){
    const [ax,az]=HIGHMERE_WALL[i],[bx,bz]=HIGHMERE_WALL[j];
    if((az>z)!==(bz>z)&&x<(bx-ax)*(z-az)/(bz-az)+ax)inside=!inside;
    if(margin>0){const dx=bx-ax,dz=bz-az,t=Math.max(0,Math.min(1,((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz)));if(Math.hypot(x-ax-t*dx,z-az-t*dz)<margin)return true;}
  }
  return inside;
}
export function regionRoadDistance(x,z) {
  let nearest=100;
  for(const road of HIGHMERE_ROADS)for(let i=1;i<road.points.length;i++){
    const [ax,az]=road.points[i-1],[bx,bz]=road.points[i],dx=bx-ax,dz=bz-az;
    if(x<Math.min(ax,bx)-20||x>Math.max(ax,bx)+20||z<Math.min(az,bz)-20||z>Math.max(az,bz)+20)continue;
    const t=Math.max(0,Math.min(1,((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz)));
    nearest=Math.min(nearest,Math.hypot(x-ax-t*dx,z-az-t*dz)-road.width/2);
  }
  return Math.min(nearest,Math.hypot(x-850,z+831)-14);
}
