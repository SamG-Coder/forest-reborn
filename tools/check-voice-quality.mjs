import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const output='test-results/voices';await mkdir(output,{recursive:true});
const browser=await chromium.launch({args:['--autoplay-policy=no-user-gesture-required']});
try{
  const page=await browser.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://127.0.0.1:5173/models/speech/nano08/config.json');
  await page.evaluate(async()=>{
    const {CharacterVoices}=await import('/src/audio/voices.js');
    window.audioContext=new AudioContext();window.voices=new CharacterVoices({getContext:()=>audioContext});
    await voices.warm();
  });
  const results=[];
  for(const voice of ['Jasper','Bruno','Hugo','Leo','Bella','Luna','Rosie','Kiki']){
    const result=await page.evaluate(async voice=>{
      const gender=['Jasper','Bruno','Hugo','Leo'].includes(voice)?'male':'female';
      const text='A late shift. A walk home. Nothing out of the ordinary.';
      const result=await voices.prepare({id:'preview-'+voice,voice,gender},text);
      if(!result)throw new Error(voices.lastError);
      const {wavBlobFromPcm}=await import('/src/vendor/kitten/wav.ts');
      return {voice,text,seconds:result.pcm.length/24000,ms:result.generationMs,bytes:Array.from(new Uint8Array(await wavBlobFromPcm(result.pcm,24000).arrayBuffer()))};
    },voice);
    await writeFile(`${output}/preview-${voice}.wav`,Buffer.from(result.bytes));delete result.bytes;results.push(result);console.log(result);
  }
  const test=await page.evaluate(async()=>{
    const text='Hey, easy now. Can you hear me? The road is clear, but watch your step.';
    const person={id:'innkeeper'},r=await voices.prepare(person,text);
    const {wavBlobFromPcm}=await import('/src/vendor/kitten/wav.ts');
    await voices.speak(person,text,{channel:'preview'});
    return {text,seconds:r.pcm.length/24000,bytes:Array.from(new Uint8Array(await wavBlobFromPcm(r.pcm,24000).arrayBuffer()))};
  });
  await writeFile(`${output}/punctuation.wav`,Buffer.from(test.bytes));delete test.bytes;
  await page.waitForFunction(()=>!voices.busy('preview'),null,{timeout:30000});
  const playback=await page.evaluate(()=>voices.playbackEvents);
  assert.equal(playback.length,1);assert.equal(playback[0].cancelled,false);assert.deepEqual(errors,[]);
  await writeFile(`${output}/quality.json`,JSON.stringify({results,test,playback,errors},null,2));
  console.log('All eight runtime voices generated. Playback completed without cancellation.');
}finally{await browser.close();}
