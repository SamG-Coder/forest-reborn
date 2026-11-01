import test from 'node:test';
import assert from 'node:assert/strict';
import {speechChunks,concatSpeech} from '../src/audio/speech-chunks.js';
import {SpeechPlayback} from '../src/audio/speech-playback.js';
import {WorldSounds} from '../src/audio/world-sounds.js';
import {EFFECTS} from '../src/audio/effects.js';
import {Vector3} from 'three';

test('streaming phrases preserve every word and punctuation, with useful first chunks',()=>{
  for(const text of ['Hey. Easy now. Can you hear me?', 'Dr. Ren paid 2.50 silver. The horse is waiting outside.', 'The quartermaster needs three bundles of wood, and someone must carry them to the northern gate before the next patrol sets out. Take the road past the tavern.']){
    const chunks=speechChunks(text);assert.equal(chunks.join(' '),text);assert.ok(chunks[0].length<125);assert.ok(chunks.every(c=>c.length>=18||chunks.length===1));
  }
  assert.deepEqual(speechChunks('Morning.'),['Morning.']);assert.deepEqual(speechChunks(''),[]);
  assert.deepEqual([...concatSpeech([{pcm:new Float32Array([.5,.25])},{pcm:new Float32Array([-.5])}])],[.5,.25,-.5]);
});

function context(){
  const ctx={currentTime:0,sources:[],createBuffer:(_channels,length,rate)=>({duration:length/rate,copyToChannel(){}})};
  ctx.createBufferSource=()=>{const source={playbackRate:{value:1},connect(){},disconnect(){},start(at,offset){Object.assign(this,{at,offset});},stop(){this.stopped=true;}};ctx.sources.push(source);return source;};return ctx;
}
test('stream playback schedules on the audio clock and pause retains unfinished samples',()=>{
  const ctx=context(),ended=[],player=new SpeechPlayback(ctx,{}, {onEnd:cancelled=>ended.push(cancelled)});
  player.push(new Float32Array(1000),1000);ctx.currentTime=.2;player.push(new Float32Array(1000),1000);
  assert.equal(ctx.sources[1].at,1.025);assert.ok(ctx.sources[1].at>ctx.currentTime);
  ctx.currentTime=.525;player.setPaused(true);assert.equal(player.active.size,0);assert.ok(Math.abs(player.pending[0].offset-.5)<.00001);assert.equal(player.pending[1].offset,0);
  ctx.currentTime=3;player.setPaused(false);assert.equal(ctx.sources[2].at,3.025);assert.equal(ctx.sources[3].at,3.525);
  player.finish();ctx.sources[0].onended();assert.deepEqual(ended,[]);
  ctx.sources[2].onended();ctx.sources[3].onended();assert.deepEqual(ended,[false]);
});
test('cancel removes every scheduled phrase without letting old callbacks finish a new line',()=>{
  const ctx=context(),ended=[],player=new SpeechPlayback(ctx,{}, {onEnd:cancelled=>ended.push(cancelled)});
  player.push(new Float32Array(1000),1000);player.push(new Float32Array(1000),1000);player.stop();
  for(const source of ctx.sources){assert.ok(source.stopped);source.onended();}assert.deepEqual(ended,[true]);assert.equal(player.active.size,0);
});
test('quiet walking and grouped gallop use different contact rhythms and stop in the air',()=>{
  function rhythm(speed){let time=0;const hits=[],sounds=new WorldSounds({play:(kind,position,options)=>hits.push({kind,time,...options})},{residents:[]});const state={mounted:true,grounded:true,speed};
    for(let i=0;i<500;i++){time=i/100;sounds.actor('horse',new Vector3(),state,.01);}const count=hits.length;
    state.grounded=false;for(let i=0;i<100;i++)sounds.actor('horse',new Vector3(),state,.01);assert.equal(hits.length,count);return hits;
  }
  const walk=rhythm(3.2),run=rhythm(8.4),gaps=run.slice(1).map((hit,i)=>hit.time-run[i].time);
  assert.ok(run.length>walk.length);assert.ok(Math.max(...gaps)>Math.min(...gaps)*2.5);assert.ok(new Set(run.map(h=>h.id)).size===4);
  assert.ok(EFFECTS.stepStone.gain<.08&&EFFECTS.hoof.gain<.13);
});
