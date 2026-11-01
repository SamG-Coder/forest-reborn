/** One worker and one in-flight request keep fast travel from queuing stale
 * landscapes. Completed chunks wait in a small cache until the render loop can
 * attach their meshes; the worker never touches scene objects. */
export class TerrainStream {
  constructor(){
    this.worker=new Worker(new URL('./terrain-worker.js',import.meta.url),{type:'module'});this.ready=new Map();this.pending=null;this.sequence=0;
    this.worker.onmessage=({data})=>{const request=this.pending;this.pending=null;if(data.error){this.error=new Error(data.error);return;}if(request?.id===data.id){this.ready.set(request.key,data.samples);while(this.ready.size>64)this.ready.delete(this.ready.keys().next().value);}};
    this.worker.onerror=event=>{this.error=new Error(event.message);this.pending=null;};
  }
  request(key,cx,cz,size){if(this.pending||this.ready.has(key))return;const id=++this.sequence;this.pending={id,key};this.worker.postMessage({id,cx,cz,size});}
  take(key){const data=this.ready.get(key);this.ready.delete(key);return data;}
  dispose(){this.worker.terminate();this.ready.clear();}
}
