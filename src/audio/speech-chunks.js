import {spokenText} from './voice-profiles.js';

/** Keep punctuation and words intact; short lines remain a single inference. */
export function speechChunks(text){
  const clean=spokenText(text);if(!clean)return [];
  const sentences=[...new Intl.Segmenter('en',{granularity:'sentence'}).segment(clean)].map(part=>part.segment.trim());
  const chunks=[];
  for(const sentence of sentences){
    if(sentence.length<=125){chunks.push(sentence);continue;}
    const clauses=sentence.split(/(?<=[,;:])\s+/u);let current='';
    for(const clause of clauses){
      const words=clause.split(/\s+/u);
      for(const word of words){
        if(current.length>105){chunks.push(current);current='';}
        current+=(current?' ':'')+word;
      }
      if(current.length>=38){chunks.push(current);current='';}
    }
    if(current)chunks.push(current);
  }
  // A one-word interjection is too short to hide the next inference's latency.
  for(let i=0;i<chunks.length-1;i++)if(chunks[i].length<18){chunks.splice(i,2,chunks[i]+' '+chunks[i+1]);i--;}
  return chunks;
}

export function concatSpeech(chunks){
  const pcm=new Float32Array(chunks.reduce((sum,chunk)=>sum+chunk.pcm.length,0));let offset=0;
  for(const chunk of chunks){pcm.set(chunk.pcm,offset);offset+=chunk.pcm.length;}
  return pcm;
}
