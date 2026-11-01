import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const base=process.argv[2]??'http://127.0.0.1:5173';
const browser=await chromium.launch({args:['--enable-gpu','--use-angle=d3d11','--autoplay-policy=no-user-gesture-required']});
await mkdir('test-results/voices',{recursive:true});
try{
  const page=await browser.newPage(),errors=[],sockets=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('websocket',s=>sockets.push(s.url()));
  await page.goto(base+'/game.html');await page.locator('#new-save').click();
  await page.waitForFunction(()=>window.gameDemo?.ready,null,{timeout:90000});
  await page.evaluate(()=>gameDemo.renderer.setAnimationLoop(null));
  const start=Date.now();await page.getByRole('button',{name:'Hear voice',exact:true}).click();
  await page.waitForFunction(()=>gameDemo.voices.channels.get('preview')?.playing,null,{timeout:30000});
  const firstPlaybackMs=Date.now()-start;
  await page.waitForFunction(()=>!gameDemo.voices.busy('preview'),null,{timeout:30000});
  const preview=await page.evaluate(()=>gameDemo.voices.playbackEvents.at(-1));
  assert.equal(preview.cancelled,false);assert.ok(preview.duration>4);
  await page.locator('#enter').click();
  // Exercise the entire voiced conversation in real time, including slow speech holds.
  const result=await page.evaluate(async()=>{
    const g=gameDemo;g.opening.time=27.8;let previous=performance.now(),deadline=previous+110000,heldFrames=0;
    await new Promise((resolve,reject)=>{
      const tick=now=>{
        if(now>deadline){reject(new Error('Opening did not finish'));return;}
        const before=g.opening.time;g.frame(Math.min(.05,(now-previous)/1000));previous=now;
        if(g.voices.busy('cinematic')&&g.opening.time-before<.002)heldFrames++;
        if(g.state.mode==='play'){resolve();return;}requestAnimationFrame(tick);
      };requestAnimationFrame(tick);
    });
    return {mode:g.state.mode,heldFrames,events:g.voices.playbackEvents.filter(e=>e.channel==='cinematic'),tomasRestored:!g.population.residents.find(p=>p.id==='innkeeper').cinematic};
  });
  assert.equal(result.mode,'play');assert.equal(result.events.length,8);assert.ok(result.events.every(e=>!e.cancelled));assert.ok(result.heldFrames>0);assert.equal(result.tomasRestored,true);
  assert.deepEqual(errors,[]);
  await writeFile('test-results/voices/spoken-opening.json',JSON.stringify({base,firstPlaybackMs,preview,...result,errors,sockets},null,2));
  console.log({base,firstPlaybackMs,previewDuration:preview.duration,linesCompleted:result.events.length,heldFrames:result.heldFrames,errors,sockets});
}finally{await browser.close();}
