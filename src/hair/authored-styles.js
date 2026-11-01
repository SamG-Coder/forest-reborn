import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {animeStrand} from './strand.js';

// Each silhouette chooses its own construction, parting, fringe, back and ties.
const styles={
 short:{crop:true,volume:.004,fringe:'crop'},
 swept:{volume:.016,fringe:'sweep',back:'short'},
 shaggy:{volume:.023,fringe:'messy',back:'choppy'},
 parted:{volume:.015,fringe:'part',back:'medium'},
 spiky:{crop:true,volume:.006,fringe:'crest'},
 undercut:{crop:true,volume:.010,fringe:'undercut'},
 topknot:{crop:true,volume:.005,fringe:'slick',knot:[0,1.86,-.04]},
 quiff:{volume:.023,fringe:'quiff',back:'short'},
 warriorbraid:{crop:true,volume:.008,fringe:'slick',braids:'warrior'},
 halftie:{volume:.017,fringe:'part',curtain:1.49,knot:[0,1.76,-.16]},
 shoulderlength:{volume:.017,fringe:'longpart',curtain:1.34},
 pixie:{crop:true,volume:.013,fringe:'pixie'},
 bob:{volume:.022,fringe:'blunt',curtain:1.51},
 long:{volume:.013,fringe:'longpart',curtain:1.29},
 wavy:{volume:.026,fringe:'sweep',curtain:1.46,wave:.025},
 crownbraid:{volume:.009,fringe:'slick',crown:true,knot:[0,1.66,-.16]},
 ponytail:{volume:.012,fringe:'wisps',tails:'low'},
 highpony:{volume:.014,fringe:'sweep',tails:'high'},
 sidebraid:{volume:.017,fringe:'sweep',braids:'side'},
 twintails:{volume:.016,fringe:'blunt',tails:'twins'},
 twinbraids:{volume:.012,fringe:'part',braids:'twins'},
 bun:{volume:.011,fringe:'wisps',knot:[0,1.74,-.17]},
};
const aliases={crew:'short',fauxhawk:'spiky',sidepart:'swept',layered:'shaggy',longwaves:'wavy',braid:'sidebraid'};
const v=p=>new THREE.Vector3(...p);

export function buildHairStyle(id,shell,lowered=false){
 const def=styles[aliases[id]??id]??styles.swept,parts=[],accessories=[],cap=shell.clone(),p=cap.attributes.position;
 // Authored control points use a reference head; fit them to this skull, not
 // an assumed human head size. Scalp-sampled points already use model space.
 shell.computeBoundingBox();const bounds=shell.boundingBox,top=bounds.max.y;
 const sx=(bounds.max.x-bounds.min.x)/.25,sz=(bounds.max.z-bounds.min.z)/.28;
 const authored=point=>new THREE.Vector3(point[0]*sx,top+(point[1]-1.83)*.65,(point[2]+.024)*sz-.024);
 for(let i=0;i<p.count;i++){
  const point=new THREE.Vector3().fromBufferAttribute(p,i),normal=point.clone().sub(v([0,1.69,-.024])).normalize();
  const row=Math.floor(i/65)/22,top=THREE.MathUtils.smoothstep(point.y,1.70,1.81);
  point.addScaledVector(normal,def.volume*.65);
  if(def.crop)point.y+=Math.pow(row,4)*.018;
  if(def.fringe==='quiff')point.y+=Math.exp(-Math.pow((point.z-.06)/.10,2))*top*.038;
  if(def.fringe==='crest')point.y+=Math.exp(-Math.pow(point.x/.047,2))*top*.046;
  p.setXYZ(i,...point);
 }
 cap.computeVertexNormals();
 const sample=(phi,t=1,offset=0)=>{
  const col=((phi/(Math.PI*2)*64)%64+64)%64,row=THREE.MathUtils.clamp(t,0,1)*22,c=Math.floor(col),r=Math.min(21,Math.floor(row));
  const at=(rr,cc)=>new THREE.Vector3().fromBufferAttribute(p,rr*65+cc);
  const point=at(r,c).lerp(at(r,c+1),col-c).lerp(at(r+1,c).lerp(at(r+1,c+1),col-c),row-r);
  return point.addScaledVector(point.clone().sub(v([0,1.69,-.024])).normalize(),offset);
 };
 const lock=(points,width=.031,depth=.008,accessory=false)=>(accessory?accessories:parts).push(animeStrand(points,width*.68,depth*.68));
 // Explicit front constructions. Slick hair follows the scalp into a tie;
 // parted hair moves away from the centre instead of adding the same fringe.
 const count={crop:7,sweep:5,messy:9,part:6,crest:7,undercut:4,slick:5,quiff:4,longpart:4,pixie:5,blunt:6,wisps:2}[def.fringe];
 for(let i=0;i<count;i++){
  const u=(i+.5)/count,phi=Math.PI*(.13+.74*u),sign=u<.5?1:-1;
  let points,width=.035;
  if(def.fringe==='slick'){
   points=[sample(phi,1,.002),sample(phi,.65,.007),sample(phi,.25,.009),sample(-Math.PI/2,.45,.008)];width=.025;
  }else if(def.fringe==='crest'){
   const z=.10-i*.032;
   points=[authored([-.06,1.76,z]),authored([-.027,1.83,z]),authored([.013,1.90+(i%2)*.015,z-.022]),authored([.032,1.86,z-.058])];width=.035;
  }else if(def.fringe==='quiff'){
   const x=(u-.5)*.21;
   points=[sample(phi,.95,.004),authored([x,1.79,.115]),authored([x+.015,1.887,.048]),authored([x+.008,1.85,-.058])];width=.035;
  }else if(def.fringe==='wisps'){
   const phi=i?Math.PI*.88:Math.PI*.12;points=[sample(phi,.36,.006),sample(phi,.75,.014),sample(phi,1,.018)];points.push(points.at(-1).clone().add(v([i?.015:-.015,-.06,.008])));width=.018;
  }else{
   const part=['part','longpart'].includes(def.fringe),sweep=['sweep','pixie','undercut'].includes(def.fringe);
   const drift=part?sign*.42:sweep?.65:Math.sin(i*2.8)*.06;
   points=[sample(phi-drift,.12,.003),sample(phi-drift*.65,.43,.012),sample(phi-drift*.15,.78,.01),sample(phi,1,.01)];
   const tip=points.at(-1).clone();
   if(part){tip.x+=sign*.025;tip.y-=def.fringe==='longpart'?.065:.03;tip.y+=.042*(1-Math.abs(u-.5)*2);}
   else if(sweep){tip.x+=.045;tip.y-=.012+.035*u;}
   else if(def.fringe==='crop')tip.y-=.008;
   else if(def.fringe==='blunt'){tip.y=1.687+Math.sin(i*2)*.006;width=.040;}
   else{tip.y-=.018+(i%3)*.014;tip.x+=Math.sin(i*3)*.017;}
   points.push(tip);if(def.fringe==='undercut')width=.045;
  }
  lock(points,width);
 }
 if(def.curtain){
  const positions=[],uv=[],index=[],cols=48,rows=12;
  for(let r=0;r<=rows;r++)for(let c=0;c<=cols;c++){
   const u=c/cols,t=r/rows,phi=Math.PI*(.88+1.24*u); // behind the ears, open at the face
   const top=sample(phi,.52,.005),rim=sample(phi,1,.009),front=Math.max(0,Math.sin(phi));
   const end=rim.clone();end.y=def.curtain+front*.13+Math.sin(u*Math.PI*16)*.008;
   end.x*=1.08;end.z-=THREE.MathUtils.smoothstep(1.50-end.y,0,.18)*.05;
   if(front>.25&&end.y<1.47)end.y=1.48;
   const point=t<.46?top.clone().lerp(rim,t/.46):rim.clone().lerp(end,(t-.46)/.54);
   point.x+=Math.cos(phi)*Math.sin(t*Math.PI)*(.012+(def.wave??0)*Math.sin(t*Math.PI*2+u*3));
   point.z+=Math.sin(phi)*Math.sin(t*Math.PI)*.012;positions.push(...point);uv.push(u*3,t);
   if(r&&c){const i=r*(cols+1)+c;index.push(i-cols-2,i-1,i-cols-1,i-cols-1,i-1,i);}
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(index);g.computeVertexNormals();parts.push(g);
 }else if(def.back){
  for(let i=0;i<10;i++){const phi=Math.PI*(.95+i/9*1.1),end=sample(phi,1,.009);end.y-=def.back==='medium'?.055:def.back==='choppy'?.030+(i%3)*.018:.008;
   lock([sample(phi,.25,.002),sample(phi,.60,.012),sample(phi,.91,.011),end],.034);}
 }
 const offset=lowered?-.095:0;
 function tail(points,width=.045){for(let i=0;i<5;i++)lock(points.map(p=>authored(p).add(v([Math.sin(i*2)*.005,offset,Math.cos(i*2)*.005]))),width*(1-i*.07),.009,true);}
 function braid(points,radius=.021,fitted=false){
  radius*=.68;
  const curve=new THREE.CatmullRomCurve3(points.map(p=>(fitted?v(p):authored(p)).add(v([0,offset,0])))),frames=curve.computeFrenetFrames(72,false);
  for(let strand=0;strand<3;strand++){
   const path=[];for(let i=0;i<=72;i++){const t=i/72,a=t*Math.PI*12+strand*Math.PI*2/3,p=curve.getPoint(t),r=radius*(1-t*.25);p.addScaledVector(frames.normals[i],Math.cos(a)*r).addScaledVector(frames.binormals[i],Math.sin(a)*r);path.push(p);}
   accessories.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(path),100,.006,7,false));
  }
 }
 if(def.tails==='low')tail([[0,1.63,-.15],[0,1.60,-.21],[.018,1.43,-.24],[.04,1.26,-.19]],.049);
 if(def.tails==='high')tail([[0,1.82,-.12],[0,1.83,-.25],[.016,1.56,-.33],[.03,1.35,-.24]],.058);
 if(def.tails==='twins')for(const s of [-1,1])tail([[s*.13,1.73,-.075],[s*.24,1.70,-.15],[s*.26,1.46,-.18],[s*.20,1.31,-.12]],.044);
 if(def.braids==='warrior')braid([[0,1.78,-.13],[0,1.64,-.19],[0,1.43,-.21],[0,1.22,-.19]],.018);
 if(def.braids==='side')braid([[.13,1.64,-.04],[.20,1.51,.10],[.23,1.35,.15],[.19,1.18,.17]],.022);
 if(def.braids==='twins')for(const s of [-1,1])braid([[s*.13,1.62,-.045],[s*.20,1.51,.035],[s*.23,1.34,.13],[s*.2,1.20,.15]],.019);
 if(def.crown){const points=[];for(let i=0;i<=32;i++)points.push(sample(i/32*Math.PI*2,.68,.008).toArray());braid(points,.009,true);}
 if(def.knot){
  const c=authored(def.knot).add(v([0,offset,0]));accessories.push(new THREE.SphereGeometry(.031,20,16).scale(1,1.05,.85).translate(...c));
  for(let i=0;i<6;i++){const path=[];for(let j=0;j<=24;j++){const a=j/24*Math.PI*2;path.push(c.clone().add(v([Math.cos(a)*.033,Math.sin(a)*.030,Math.sin(a+i)*.009])));}
   accessories.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(path),28,.0035,6,false));}
 }
 const merge=items=>{if(!items.length)return null;const g=mergeGeometries(items);items.forEach(p=>p.dispose());return g;};
 return {cap,locks:merge(parts),accessories:merge(accessories),long:Boolean(def.curtain||def.tails||def.braids)};
}
