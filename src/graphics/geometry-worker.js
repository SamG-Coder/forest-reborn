import {packGeometry,unpackGeometry,geometryTransfers} from './geometry-transfer.js';
import {clusterSkinnedGeometry} from './skinned-lod.js';
self.onmessage=({data})=>{
  try{
    const source=unpackGeometry(data.geometry),result=clusterSkinnedGeometry(source,data.size),geometry=packGeometry(result);
    self.postMessage({id:data.id,geometry},geometryTransfers(geometry));source.dispose();result.dispose();
  }catch(error){self.postMessage({id:data.id,error:error.message});}
};
