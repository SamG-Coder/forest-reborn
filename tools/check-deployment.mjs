import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';

const base=new URL(process.argv[2]??'http://127.0.0.1:5180/forest-reborn/');
if(!base.pathname.endsWith('/'))base.pathname+='/';
const output='test-results/deployment';await mkdir(output,{recursive:true});
const args=process.platform==='win32'?['--enable-gpu','--use-angle=d3d11']:['--enable-webgl','--enable-unsafe-swiftshader'];
const browser=await chromium.launch({args});
const errors=[],failedRequests=[],outsideBase=[];
try{
  const context=await browser.newContext({viewport:{width:1280,height:800}});
  context.on('response',response=>{if(response.status()>=400)failedRequests.push({url:response.url(),status:response.status()});});
  context.on('request',request=>{const url=new URL(request.url());if(/^https?:$/.test(url.protocol)&&url.origin===base.origin&&!url.pathname.startsWith(base.pathname))outsideBase.push(url.pathname);});
  const page=await context.newPage();page.setDefaultTimeout(120000);
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(base.href);
  console.log('Save menu loaded');
  await page.locator('#new-save').click();
  await page.waitForFunction(()=>window.gameDemo?.ready,null,{timeout:120000});
  // Advance animation explicitly: CI checks loading and interactions, not GPU throughput.
  await page.evaluate(()=>{gameDemo.renderer.setAnimationLoop(null);gameDemo.frame(1/60);});
  console.log('Character creator loaded');
  const coins=await page.evaluate(()=>gameDemo.progress.data.coins);assert.equal(coins,50000);
  await page.screenshot({path:`${output}/creator.png`});
  const voice=await page.evaluate(async()=>{
    const result=await gameDemo.voices.prepare({id:'deployment-check'},'The road to Mosswake is open.');
    return {samples:result?.pcm.length??0,rate:result?.sampleRate,error:gameDemo.voices.lastError};
  });
  assert.ok(voice.samples>2400,`runtime voice synthesis failed: ${voice.error}`);
  console.log('Runtime voice generated');
  await page.locator('#enter').click();
  await page.waitForFunction(()=>gameDemo.state.mode==='opening');
  await page.evaluate(()=>{gameDemo.voices.setMuted(true);gameDemo.opening.finish();});
  await page.waitForFunction(()=>gameDemo.state.mode==='play');
  await page.keyboard.down('w');await page.evaluate(()=>{for(let i=0;i<8;i++)gameDemo.frame(.05);});await page.keyboard.up('w');
  await page.screenshot({path:`${output}/world.png`});
  console.log('Opening and world loaded');
  // Prove the hosted save path retains a spent balance instead of re-granting 5g.
  await page.evaluate(()=>{gameDemo.progress.data.coins=49955;gameDemo.saveSession();});
  await page.reload();
  await page.locator('[data-continue-save]').click();
  await page.waitForFunction(()=>window.gameDemo?.ready,null,{timeout:120000});
  await page.evaluate(()=>gameDemo.renderer.setAnimationLoop(null));
  assert.equal(await page.evaluate(()=>gameDemo.progress.data.coins),49955);
  console.log('Saved balance restored');
  await page.goto(new URL('creatures.html',base).href);
  await page.waitForFunction(()=>window.creaturePreview?.ready,null,{timeout:120000});
  await page.evaluate(()=>creaturePreview.renderer.setAnimationLoop(null));
  await page.locator('#goblins').click();
  await page.locator('#motion').selectOption('run');
  await page.evaluate(()=>creaturePreview.frame(.05));
  await page.screenshot({path:`${output}/goblins.png`});
  await page.goto(new URL('validation.html',base).href);
  await page.waitForFunction(()=>document.getElementById('iou')?.textContent.endsWith('%'));
  await page.waitForFunction(()=>[...document.images].every(image=>image.complete&&image.naturalWidth>0));
  assert.deepEqual(errors,[]);assert.deepEqual(failedRequests,[]);assert.deepEqual([...new Set(outsideBase)],[]);
  const result={url:base.href,startingCoins:coins,savedCoins:49955,voice,errors,failedRequests,outsideBase};
  await writeFile(`${output}/result.json`,JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}catch(error){
  console.error(JSON.stringify({errors,failedRequests,outsideBase},null,2));throw error;
}finally{await browser.close();}
