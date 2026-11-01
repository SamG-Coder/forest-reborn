import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
await mkdir('test-results/voices',{recursive:true});
const browser=await chromium.launch({args:['--autoplay-policy=no-user-gesture-required']});
try{
  const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://127.0.0.1:5173/models/speech/nano08/config.json');
  const warm=await page.evaluate(async()=>{
    const {CharacterVoices}=await import('/src/audio/voices.js');
    window.audioContext=new AudioContext();window.voices=new CharacterVoices({getContext:()=>audioContext});
    const start=performance.now();await voices.warm();return {ms:performance.now()-start,status:voices.status};
  });console.log('Model ready:',warm);
  const first=await page.evaluate(async()=>{
    window.line="Easy now. You're in Mosswake. I'm Tomas. Sit up slowly; you've had a rough morning. There is bread by the fire if you can stomach it.";
    const start=performance.now(),started=await voices.speak({id:'innkeeper'},line);
    const entry=[...voices.cache.values()].at(-1),result={started,firstMs:performance.now()-start,chunksReady:entry.chunks.length,allReadyAtStart:entry.done};
    const generated=await entry.promise;result.allMs=performance.now()-start;result.chunks=generated.chunks.map(c=>({text:c.text,seconds:c.pcm.length/c.sampleRate,ms:c.generationMs}));
    const {wavBlobFromPcm}=await import('/src/vendor/kitten/wav.ts');result.bytes=Array.from(new Uint8Array(await wavBlobFromPcm(generated.pcm,24000).arrayBuffer()));return result;
  });
  await writeFile('test-results/voices/stream-tomas.wav',Buffer.from(first.bytes));delete first.bytes;
  assert.ok(first.started);assert.equal(first.allReadyAtStart,false);assert.ok(first.firstMs<first.allMs);console.log('Progressive speech:',first);
  await page.waitForFunction(()=>!voices.busy('dialogue'),null,{timeout:45000});
  const complete=await page.evaluate(()=>voices.playbackEvents.at(-1));assert.equal(complete.cancelled,false);assert.equal(complete.chunks,first.chunks.length);assert.equal(complete.underruns,0);
  const pause=await page.evaluate(async()=>{
    await voices.speak({id:'innkeeper'},line);await new Promise(r=>setTimeout(r,150));voices.setPaused(true);
    const token=voices.channels.get('dialogue'),pending=token.playback.pending.length,activePaused=token.playback.active.size;
    await new Promise(r=>setTimeout(r,250));voices.setPaused(false);
    const activeResumed=token.playback.active.size,offset=[...token.playback.active][0].offset;voices.stop('dialogue');
    return {pending,activePaused,activeResumed,offset,cancelled:voices.playbackEvents.at(-1).cancelled};
  });
  assert.ok(pause.pending>0&&pause.activeResumed>0&&pause.offset>0);assert.equal(pause.activePaused,0);assert.equal(pause.cancelled,true);
  const cancel=await page.evaluate(async()=>{
    const pending=voices.speak({id:'new-speaker',gender:'female'},'Please take the road around the north side of the village. The watch is waiting at the gate.');
    voices.stop('dialogue');const cancelledStarted=await pending;
    const start=performance.now(),nextStarted=await voices.speak({id:'new-speaker',gender:'female'},'The road is clear. Take care of yourself.');
    return {cancelledStarted,nextStarted,firstMs:performance.now()-start};
  });assert.equal(cancel.cancelledStarted,false);assert.equal(cancel.nextStarted,true);
  await page.waitForFunction(()=>!voices.busy('dialogue'),null,{timeout:30000});
  assert.deepEqual(errors,[]);const result={warm,first,complete,pause,cancel,errors};console.log(result);await writeFile('test-results/voices/streaming.json',JSON.stringify(result,null,2));
  await page.evaluate(()=>{voices.dispose();audioContext.close();});
}finally{await browser.close();}
