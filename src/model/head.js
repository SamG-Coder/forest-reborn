import * as THREE from 'three';
import headFit from '../fitting/head-fit.json' with {type:'json'};

/** Head proportions are expressed in the existing male rig's bind-space metres.
 * The surface is continuous; local displacements form anatomical planes instead
 * of placing features onto a generic head. All facial artwork stays in the original UV texture.
 */
export const HEAD={bottom:2.40,top:3.045,eyeY:2.735,eyeX:.105,eyeWidth:.067,eyeHeight:.025,mouthY:2.535};
const gauss=(x,c,w)=>Math.exp(-(((x-c)/w)**2));
const profile=[
 [2.400,.025,.105,-.005],[2.425,.085,.137,-.018],[2.460,.133,.153,-.025],
 [2.510,.179,.161,-.035],[2.570,.205,.163,-.040],[2.640,.223,.173,-.042],
 [2.710,.231,.174,-.038],[2.780,.234,.171,-.030],[2.850,.231,.170,-.020],
 [2.920,.218,.162,-.005],[2.980,.176,.135,.003],[3.025,.098,.080,.008],[3.045,.001,.001,.008],
];
function sample(y,column){
 if(column===1&&y>3.00)return .149*Math.sqrt(Math.max(0,(HEAD.top-y)/.045));
 let i=0;while(i<profile.length-2&&y>profile[i+1][0])i++;
 const a=profile[i],b=profile[i+1],t=THREE.MathUtils.clamp((y-a[0])/(b[0]-a[0]),0,1);
 const before=profile[Math.max(0,i-1)],after=profile[Math.min(profile.length-1,i+2)];
 const m0=(b[column]-before[column])/(b[0]-before[0])*(b[0]-a[0]);
 const m1=(after[column]-a[column])/(after[0]-a[0])*(b[0]-a[0]);
 return (2*t**3-3*t*t+1)*a[column]+(t**3-2*t*t+t)*m0+(-2*t**3+3*t*t)*b[column]+(t**3-t*t)*m1;
}
function fittedRow(y){
 const rows=headFit.rows,t=THREE.MathUtils.clamp((y-HEAD.bottom)/(HEAD.top-HEAD.bottom)*(rows.length-1),0,rows.length-1);
 const a=Math.floor(t),b=Math.min(a+1,rows.length-1),f=t-a;
 return rows[a].map((value,column)=>THREE.MathUtils.lerp(value,rows[b][column],f));
}
function smoothFront(y){
 return (fittedRow(y-.032)[2]+2*fittedRow(y-.016)[2]+3*fittedRow(y)[2]+2*fittedRow(y+.016)[2]+fittedRow(y+.032)[2])/9;
}
export function faceDepth(x,y){
 if(headFit.enabled){
  const [,width,front,back]=fittedRow(y),base=smoothFront(y),center=(base+back)/2;
  const u=Math.min(1,Math.abs(x)/width);
  const featureWidth=y<2.57?.055:.032;
  return Math.min(front,center+(base-center)*Math.pow(Math.max(0,1-u*u),headFit.frontExponent??.5)+(front-base)*gauss(x,0,featureWidth));
 }
 const radius=sample(y,1),u=Math.min(.999,Math.abs(x)/Math.max(.001,radius));
 const center=ringCenter(y);
 let z=center+(sample(y,2)-center)*Math.pow(1-u*u,.36);
 // Eye sockets, supraorbital ridge, cheekbones and softened muzzle.
 for(const sign of [-1,1]){
  z-=.009*gauss(x,sign*HEAD.eyeX,.063)*gauss(y,HEAD.eyeY,.036);
  z+=.003*gauss(x,sign*.107,.07)*gauss(y,2.782,.020);
  z+=.006*gauss(x,sign*.145,.065)*gauss(y,2.66,.050);
  z-=.003*gauss(x,sign*.16,.065)*gauss(y,2.565,.060);
 }
 // Nasal root, bridge, tip, alae, columella and subnasal break.
 z+=.026*gauss(x,0,.023)*gauss(y,2.691,.072);
 z+=.047*gauss(x,0,.028)*gauss(y,2.630,.026);
 z+=.010*(gauss(x,-.026,.013)+gauss(x,.026,.013))*gauss(y,2.617,.014);
 z-=.010*gauss(x,0,.037)*gauss(y,2.594,.011);
 z+=.002*(gauss(x,-.009,.006)+gauss(x,.009,.006))*gauss(y,2.571,.022);
 // Upper/lower lips and labiomental groove, with a shaped chin below.
 const cupid=.0035*(1-gauss(x,0,.014));
 z+=.006*gauss(x,0,.053)*gauss(y,HEAD.mouthY+.008+cupid,.009);
 z+=.008*gauss(x,0,.045)*gauss(y,HEAD.mouthY-.010,.011);
 z-=.006*gauss(x,0,.055)*gauss(y,2.505,.010);
 z+=.012*gauss(x,0,.060)*gauss(y,2.464,.023);
 return z;
}
function ringCenter(y){return .10*gauss(y,2.40,.055);}
function rearRadius(y){
 const points=[[2.40,.001],[2.44,.025],[2.50,.075],[2.57,.145],[2.64,.205],[2.72,.235],[2.82,.24],[2.92,.217],[2.98,.16],[3.045,0]];
 if(y>2.98)return .16*Math.sqrt(Math.max(0,(HEAD.top-y)/.065));
 let i=0;while(i<points.length-2&&y>points[i+1][0])i++;
 const a=points[i],b=points[i+1],before=points[Math.max(0,i-1)],after=points[Math.min(points.length-1,i+2)];
 const t=THREE.MathUtils.clamp((y-a[0])/(b[0]-a[0]),0,1);
 const m0=(b[1]-before[1])/(b[0]-before[0])*(b[0]-a[0]),m1=(after[1]-a[1])/(after[0]-a[0])*(b[0]-a[0]);
 return (2*t**3-3*t*t+1)*a[1]+(t**3-2*t*t+t)*m0+(-2*t**3+3*t*t)*b[1]+(t**3-t*t)*m1;
}
// Landmark-aligned UVs preserve the original generated face artwork unchanged.
export function faceUV(x,y){
 const anchors=[[2.40,0],[2.535,.25],[2.630,.36],[2.735,.55],[2.81,.65],[3.045,1]];
 let i=0;while(i<anchors.length-2&&y>anchors[i+1][0])i++;
 const t=THREE.MathUtils.clamp((y-anchors[i][0])/(anchors[i+1][0]-anchors[i][0]),0,1);
 const width=.56+.13*gauss(y,2.535,.035);
 return [THREE.MathUtils.clamp(x/width+.5,0,1),THREE.MathUtils.lerp(anchors[i][1],anchors[i+1][1],t)];
}
function buildSurface(){
 const p=[],uv=[],frontIndices=[],backIndices=[],around=160,rows=160;
 for(let j=0;j<=rows;j++){
  const y=HEAD.bottom+(HEAD.top-HEAD.bottom)*j/rows;
  for(let i=0;i<=around;i++){
   const fit=headFit.enabled?fittedRow(y):null;
   const a=-Math.PI+i/around*Math.PI*2,x=Math.sin(a)*(fit?fit[1]:sample(y,1)),front=Math.cos(a)>=0;
   const center=fit?(smoothFront(y)+fit[3])/2:ringCenter(y),rear=fit?center-fit[3]:rearRadius(y);
   const z=front?faceDepth(x,y):center+Math.cos(a)*rear;
   const tex=front?faceUV(x,y):[.02,faceUV(0,y)[1]];
   p.push(x,y,z);uv.push(tex[0]*.5,tex[1]);
  }
 }
 for(let j=0;j<rows;j++)for(let i=0;i<around;i++){
  const a=j*(around+1)+i,b=a+around+1;
  const midpoint=-Math.PI+(i+.5)/around*Math.PI*2;
  const indices=Math.cos(midpoint)>=0?frontIndices:backIndices;
  indices.push(a,a+1,b,b,a+1,b+1);
 }
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(p,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex([...frontIndices,...backIndices]);geometry.addGroup(0,frontIndices.length,0);geometry.addGroup(frontIndices.length,backIndices.length,1);geometry.computeVertexNormals();
 return geometry;
}
export function buildMaleHead(add,m){
 add('head','male_head_surface',buildSurface(),[m.face,m.face],'head');
 for(const sign of [-1,1])buildEar(add,m,sign,sign===1?'L':'R');
}
function buildEar(add,m,sign,side){
 // Ear shape is geometry; all internal folds are painted in the shared head atlas.
 const outline=[[0,-.075],[.018,-.064],[.036,-.032],[.042,.018],[.034,.066],[.016,.083],[-.004,.071],[-.012,.033],[-.009,-.015],[0,-.075]];
 const curve=new THREE.CatmullRomCurve3(outline.map(([u,v])=>new THREE.Vector3(u,v,0)),true);
 const p=[],uv=[],idx=[],rings=18,steps=64;
 for(let j=0;j<=rings;j++)for(let i=0;i<=steps;i++){
  const r=j/rings,edge=curve.getPoint(i/steps),u=.008+(edge.x-.008)*r,v=edge.y*r;
  const depth=-.008+.018*r*r;
  p.push(sign*(.225+u+depth*.45),2.685+v,-.085+depth-u*.6);
  uv.push(.5+(.74-(u+.012)/.056*.52)*.5,.04+(v+.075)/.158*.92);
 }
 for(let j=0;j<rings;j++)for(let i=0;i<steps;i++){const a=j*(steps+1)+i,b=a+steps+1;idx.push(a,a+1,b,b,a+1,b+1);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();add('head',`ear_surface_${side}`,g,m.face,'head');
}
