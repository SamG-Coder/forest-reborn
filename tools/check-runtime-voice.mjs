import {chromium} from '@playwright/test';
import {mkdir, writeFile} from 'node:fs/promises';
const browser = await chromium.launch({headless:true,args:['--enable-gpu','--use-angle=d3d11']});
const page = await browser.newPage();
page.on('console',msg=>{if(msg.type()==='error')console.error(msg.text());});
page.on('pageerror',error=>console.error(error.message));
await page.goto('http://127.0.0.1:5173/models/speech/nano08/config.json');
const report = await page.evaluate(async()=>{
  const {CharacterVoices}=await import('/src/audio/voices.js');
  const context = new AudioContext();
  const voices = new CharacterVoices({getContext:()=>context});
  const start=performance.now();await voices.warm();
  const result=await voices.prepare({id:'innkeeper'},'Easy now. You are in Mosswake. I am Tomas.');
  if(!result)throw new Error(voices.lastError);
  const {wavBlobFromPcm}=await import('/src/vendor/kitten/wav.ts');
  const bytes=Array.from(new Uint8Array(await wavBlobFromPcm(result.pcm,24000).arrayBuffer()));
  const cached=await voices.prepare({id:'innkeeper'},'Easy now. You are in Mosswake. I am Tomas.');
  const female=await voices.prepare({id:'test-female',gender:'female'},'You made it back. I kept a place for you by the fire.');
  const value={status:voices.status,loadAndGenerateMs:performance.now()-start,generationMs:result.generationMs,seconds:result.pcm.length/24000,rms:Math.sqrt(result.pcm.reduce((sum,v)=>sum+v*v,0)/result.pcm.length),cached:cached===result,femaleSeconds:female?.pcm.length/24000,error:voices.lastError,bytes};
  voices.dispose();await context.close();return value;
});
await mkdir('test-results/voices',{recursive:true});
await writeFile('test-results/voices/tomas.wav',Buffer.from(report.bytes));delete report.bytes;
await writeFile('test-results/voices/runtime.json',JSON.stringify(report,null,2));
console.log(report);await browser.close();
if(report.rms<.001||!report.cached||!report.femaleSeconds)process.exitCode=1;

