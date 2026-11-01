const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

/** Map coordinates are metres, north is -Z. Shared by the minimap and atlas. */
export class MapView {
  constructor({x=0,z=0,range=100,minRange=20,maxRange=2200,size=500,following=true}={}){
    Object.assign(this,{x,z,range,minRange,maxRange,size,following});
  }
  project(x,z){const scale=this.size/(2*this.range);return {x:this.size/2+(x-this.x)*scale,y:this.size/2+(z-this.z)*scale};}
  unproject(x,y){const scale=2*this.range/this.size;return {x:this.x+(x-this.size/2)*scale,z:this.z+(y-this.size/2)*scale};}
  follow(position){if(this.following){this.x=position.x;this.z=position.z;}}
  recenter(position){this.following=true;this.follow(position);}
  pan(dx,dy){this.following=false;this.x-=dx*2*this.range/this.size;this.z-=dy*2*this.range/this.size;this.clamp();}
  zoom(delta,x=this.size/2,y=this.size/2){
    // A following map stays centred on the player. A panned map zooms at the cursor.
    const anchor=this.unproject(x,y);
    this.range=clamp(this.range*Math.exp(clamp(delta,-300,300)*.0018),this.minRange,this.maxRange);
    if(!this.following){const after=this.unproject(x,y);this.x+=anchor.x-after.x;this.z+=anchor.z-after.z;this.clamp();}
  }
  clamp(){this.x=clamp(this.x,-2000,2000);this.z=clamp(this.z,-2000,2000);}
}

/** Isolate map input from camera, targeting and browser scroll. */
export function bindMapInput(canvas,view,onChange){
  const events=new AbortController(),options={signal:events.signal};let drag=null;
  const point=e=>{const r=canvas.getBoundingClientRect();return {x:(e.clientX-r.left)*view.size/r.width,y:(e.clientY-r.top)*view.size/r.height};};
  canvas.addEventListener('wheel',e=>{e.preventDefault();e.stopPropagation();const p=point(e);view.zoom(e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?view.size:1),p.x,p.y);onChange();},{...options,passive:false});
  canvas.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();e.stopPropagation();drag={id:e.pointerId,...point(e)};canvas.setPointerCapture(e.pointerId);canvas.classList.add('panning');},options);
  canvas.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.id)return;e.preventDefault();e.stopPropagation();const p=point(e);view.pan(p.x-drag.x,p.y-drag.y);Object.assign(drag,p);onChange();},options);
  const release=()=>{drag=null;canvas.classList.remove('panning');};
  for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,release,options);
  for(const event of ['mousedown','mouseup','click','dblclick','contextmenu'])canvas.addEventListener(event,e=>{e.stopPropagation();if(event==='contextmenu')e.preventDefault();},options);
  window.addEventListener('blur',release,options);
  return ()=>{release();events.abort();};
}
