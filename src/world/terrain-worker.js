import {sampleTerrainChunk} from './terrain-chunk.js';
self.onmessage=({data})=>{
  try{const samples=sampleTerrainChunk(data.cx,data.cz,data.size);self.postMessage({id:data.id,samples},Object.values(samples).map(a=>a.buffer));}
  catch(error){self.postMessage({id:data.id,error:error.message});}
};
