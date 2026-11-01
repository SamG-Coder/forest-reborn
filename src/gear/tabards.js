import * as THREE from 'three';
const textures=new Map();
export function tabardTexture(item){
  const key=JSON.stringify([item.faction??item.guild??'free',item.color,item.emblem,item.emblemColor]);if(textures.has(key))return textures.get(key);
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=512;const c=canvas.getContext('2d');c.fillStyle=item.color??'#365c7a';c.fillRect(0,0,256,512);
  c.strokeStyle='#e2c995';c.lineWidth=7;c.strokeRect(12,10,232,492);c.lineWidth=2;c.strokeRect(20,18,216,476);
  c.fillStyle=item.emblemColor??'#e8dfc3';c.translate(128,164);
  if(item.emblem==='flame'){c.beginPath();c.moveTo(0,-64);c.bezierCurveTo(58,-8,60,40,0,63);c.bezierCurveTo(-60,35,-47,-8,-19,-34);c.lineTo(-10,2);c.closePath();c.fill();}
  else if(item.emblem==='tree'){c.fillRect(-7,-8,14,80);for(const [x,y,r]of [[0,-32,37],[-24,-8,28],[25,-6,29]]){c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();}}
  else {c.beginPath();c.moveTo(-43,-52);c.lineTo(43,-52);c.lineTo(37,23);c.lineTo(0,65);c.lineTo(-37,23);c.closePath();c.fill();c.fillStyle=item.color??'#365c7a';c.fillRect(-7,-37,14,76);c.fillRect(-28,-12,56,12);}
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=8;textures.set(key,texture);return texture;
}

/** Continuous front/back panels with shoulder straps; open sides clear arm IK. */
export function tabardGeometry(){
  const p=[],uv=[],idx=[],columns=16,rows=24;
  for(const side of [1,-1]){
    const base=p.length/3;
    for(let r=0;r<=rows;r++)for(let col=0;col<=columns;col++){
      const v=r/rows,u=col/columns,y=1.47-v*.73,width=y>1.1?.13:.16,x=(u-.5)*2*width;
      const depth=y>1.3?.193:y>1.12?.174:y>.98?.160:.170+(1-y)*.035;
      p.push(x,y,side*(depth-Math.abs(x)*.12));uv.push(u,1-v);
      if(r&&col){const a=base+r*(columns+1)+col,b=a-1,c=a-columns-1,d=c-1;idx.push(...(side>0?[a,c,b,b,c,d]:[a,b,c,b,d,c]));}
    }
  }
  // Bridge each shoulder without closing the neck aperture.
  for(const sign of [-1,1]){const base=p.length/3;for(let r=0;r<=10;r++){const t=r/10,z=.178-t*.356,y=1.47+Math.sin(t*Math.PI)*.08;for(const x of [.085,.13]){p.push(sign*x,y,z);uv.push(x<.1?0:1,.98);}if(r){const a=base+r*2;idx.push(a-2,a,a-1,a-1,a,a+1);}}}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g;
}
