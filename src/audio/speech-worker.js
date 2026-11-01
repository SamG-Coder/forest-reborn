import * as ort from 'onnxruntime-web/wasm';
import wasmUrl from '../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm?url';
import runtimeUrl from '../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.mjs?url';
import {KittenTTSWeb} from '../vendor/kitten/index';
import {padSpeech} from './pcm.js';
import {publicUrl} from '../assets/public-url.js';
import {speechChunks} from './speech-chunks.js';

ort.env.wasm.numThreads = 1;
ort.env.wasm.wasmPaths = {wasm: wasmUrl, mjs: runtimeUrl};
let engine;
async function ready() {
  engine ??= (async () => {
    self.postMessage({status: 'Loading voice model…'});
    let cache;
    try { cache = await caches.open('forest-reborn-voices-nano08'); } catch { /* Private browsing still works. */ }
    const model = await KittenTTSWeb.create({
      modelBaseUrl: new URL(publicUrl('/models/speech/nano08'), self.location.origin).href,
      cache, executionProvider: 'wasm', phonemizerMode: 'espeak', retryCount: 0,
    });
    self.postMessage({status: 'Voices ready'});
    return model;
  })();
  return engine;
}

// Yield between phrases so an obsolete line or prefetch cannot block conversation.
const jobs=[];let running=false,current=null,scheduled=false;
async function pump(){
  if(running)return;running=true;
  while(jobs.length){
    jobs.sort((a,b)=>(b.priority??0)-(a.priority??0)||a.id-b.id);current=jobs.shift();const data=current;
    try {
      const model = await ready();
      if(data.cancelled){self.postMessage({id:data.id,cancelled:true});continue;}
      if (data.type === 'warm') { self.postMessage({id: data.id, ready: true}); continue; }
      data.parts??=speechChunks(data.text);data.index??=0;data.generationMs??=0;
      const start=performance.now(),text=data.parts[data.index];
      const pcm = padSpeech(await model.generate(text, {voice: data.profile.voice, speed: data.profile.speed, cleanText: false}));
      if (!pcm.length || pcm.some(value => !Number.isFinite(value))) throw new Error('Speech model returned invalid audio.');
      if(data.cancelled){self.postMessage({id:data.id,cancelled:true});continue;}
      data.generationMs+=performance.now()-start;
      self.postMessage({id:data.id,chunk:true,index:data.index,text,pcm,sampleRate:24000,generationMs:performance.now()-start},[pcm.buffer]);
      if(++data.index<data.parts.length)jobs.push(data);
      else self.postMessage({id:data.id,done:true,generationMs:data.generationMs});
    } catch (error) {
      self.postMessage({id: data.id, error: error.message || String(error)});
    }
  }
  current=null;running=false;
}
self.onmessage=({data})=>{
  if(data.type==='cancel'){
    if(current?.id===data.id)current.cancelled=true;
    for(let i=jobs.length-1;i>=0;i--)if(jobs[i].id===data.id){jobs.splice(i,1);self.postMessage({id:data.id,cancelled:true});}
  }else if(data.type==='priority'){
    for(const job of [...jobs,...(current?[current]:[])])if(job.id===data.id)job.priority=data.priority;
  }else{
    jobs.push(data);
    // Let same-turn cancellation/priority messages arrive before expensive inference.
    if(!running&&!scheduled){scheduled=true;setTimeout(()=>{scheduled=false;pump();},0);}
  }
};

