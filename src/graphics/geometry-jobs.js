import {packGeometry,unpackGeometry,geometryTransfers} from './geometry-transfer.js';
import {clusterSkinnedGeometry} from './skinned-lod.js';
let worker,sequence=0;const jobs=new Map();
export function clusterGeometryAsync(source,size){
  if(!size||typeof Worker==='undefined')return Promise.resolve(clusterSkinnedGeometry(source,size));
  if(!worker){
    worker=new Worker(new URL('./geometry-worker.js',import.meta.url),{type:'module'});
    worker.onmessage=({data})=>{const job=jobs.get(data.id);if(!job)return;jobs.delete(data.id);if(data.error)job.reject(new Error(data.error));else job.resolve(unpackGeometry(data.geometry));};
    worker.onerror=e=>{for(const job of jobs.values())job.reject(new Error(e.message));jobs.clear();worker.terminate();worker=null;};
  }
  const id=++sequence,geometry=packGeometry(source,true);
  return new Promise((resolve,reject)=>{jobs.set(id,{resolve,reject});worker.postMessage({id,geometry,size},geometryTransfers(geometry));});
}
