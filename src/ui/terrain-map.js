import {terrainHeight,WORLD_HALF,CHUNK_SIZE} from '../world/terrain.js';
import {treePlacements} from '../world/vegetation-placement.js';
import {waterSample} from '../world/watersheds.js';

const mix=(a,b,t)=>a+(b-a)*t;
const limit=(v,a,b)=>Math.max(a,Math.min(b,v));
/** Small, bounded relief tiles sampled from the same terrain as the 3D world. */
export class TerrainMap {
  constructor(){this.tiles=new Map();this.trees=new Map();}
  tile(tx,tz,step){
    const key=`${tx}:${tz}:${step}`;if(this.tiles.has(key)){const tile=this.tiles.get(key);this.tiles.delete(key);this.tiles.set(key,tile);return tile;}
    const size=64,canvas=document.createElement('canvas');canvas.width=canvas.height=size;
    const ctx=canvas.getContext('2d'),image=ctx.createImageData(size,size),heights=new Float32Array(66*66);
    for(let z=0;z<66;z++)for(let x=0;x<66;x++)heights[z*66+x]=terrainHeight((tx*size+x-1)*step,(tz*size+z-1)*step);
    for(let z=0;z<size;z++)for(let x=0;x<size;x++){
      const wx=(tx*size+x)*step,wz=(tz*size+z)*step,i=(z+1)*66+x+1,h=heights[i];
      const dx=(heights[i+1]-heights[i-1])/(2*step),dz=(heights[i+66]-heights[i-66])/(2*step),slope=Math.hypot(dx,dz);
      const relief=limit(.91+(-dx*.62-dz*.48)/Math.sqrt(1+slope*slope),.52,1.24);
      const dry=limit((h+4)/55,0,1),stone=limit((slope-.35)*1.2,0,.8);
      const noise=Math.sin(wx*1.7+wz*2.3)*Math.sin(wx*.57-wz*.86)*3;
      const contour=Math.abs(h/5-Math.round(h/5))<.035?-.07:0;
      const w=waterSample(wx,wz);
      const rgb=w&&w.shore<0?[57,123,143].map(v=>v+15*Math.max(0,1+(w.shore/12))):[mix(83,145,dry),mix(113,139,dry),mix(78,102,dry)].map((v,j)=>mix(v,[148,145,127][j],stone)*(relief+contour)+noise);
      const o=(z*size+x)*4,outside=Math.abs(wx)>WORLD_HALF||Math.abs(wz)>WORLD_HALF;
      image.data[o]=outside?29:rgb[0];image.data[o+1]=outside?47:rgb[1];image.data[o+2]=outside?44:rgb[2];image.data[o+3]=255;
    }
    ctx.putImageData(image,0,0);this.tiles.set(key,canvas);while(this.tiles.size>96)this.tiles.delete(this.tiles.keys().next().value);return canvas;
  }
  draw(ctx,view){
    const step=2**Math.floor(Math.log2(Math.max(.5,view.range/90))),span=64*step,scale=view.size/(2*view.range);
    ctx.imageSmoothingEnabled=true;
    for(let z=Math.floor((view.z-view.range)/span);z<=Math.floor((view.z+view.range)/span);z++)for(let x=Math.floor((view.x-view.range)/span);x<=Math.floor((view.x+view.range)/span);x++){
      const p=view.project(x*span,z*span);ctx.drawImage(this.tile(x,z,step),p.x,p.y,span*scale+.5,span*scale+.5);
    }
    // Matching canopy locations remain useful at local scales; omit individual trees on the atlas.
    if(view.range>280)return;
    ctx.fillStyle='#2c503f60';ctx.strokeStyle='#73936770';ctx.lineWidth=.5;
    for(let z=Math.floor((view.z-view.range)/CHUNK_SIZE);z<=Math.floor((view.z+view.range)/CHUNK_SIZE);z++)for(let x=Math.floor((view.x-view.range)/CHUNK_SIZE);x<=Math.floor((view.x+view.range)/CHUNK_SIZE);x++){
      const key=`${x}:${z}`;if(!this.trees.has(key))this.trees.set(key,treePlacements(x,z));
      for(const tree of this.trees.get(key)){const p=view.project(tree.x,tree.z);ctx.beginPath();ctx.arc(p.x,p.y,Math.max(.6,tree.s*2.5*scale),0,Math.PI*2);ctx.fill();ctx.stroke();}
    }
    while(this.trees.size>100)this.trees.delete(this.trees.keys().next().value);
  }
}
