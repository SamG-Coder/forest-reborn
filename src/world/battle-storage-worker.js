import {packBattle,unpackBattle} from './battle-codec.js';
self.onmessage=({data})=>{try{self.postMessage({id:data.id,result:data.kind==='pack'?packBattle(data.value):unpackBattle(data.value)});}catch(error){self.postMessage({id:data.id,error:error.message});}};
