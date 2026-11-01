import {packBattle,unpackBattle} from './battle-codec.js';
export {packBattle,unpackBattle};
export class BattleStorage {
  constructor(){this.pending=new Map();this.sequence=0;}
  run(kind,value){
    if(typeof Worker==='undefined')return Promise.resolve(kind==='pack'?packBattle(value):unpackBattle(value));
    if(!this.worker){
      this.worker=new Worker(new URL('./battle-storage-worker.js',import.meta.url),{type:'module'});
      this.worker.onmessage=({data})=>{const job=this.pending.get(data.id);if(!job)return;this.pending.delete(data.id);if(data.error)job.reject(new Error(data.error));else job.resolve(data.result);};
      this.worker.onerror=e=>{for(const job of this.pending.values())job.reject(new Error(e.message));this.pending.clear();this.worker.terminate();this.worker=null;};
    }
    const id=++this.sequence;return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});this.worker.postMessage({id,kind,value});});
  }
  pack(value){return this.run('pack',value);}
  unpack(value){return this.run('unpack',value);}
  dispose(){this.worker?.terminate();for(const job of this.pending.values())job.reject(new Error('Battle storage closed'));this.pending.clear();}
}
