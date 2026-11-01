import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
await mkdir('test-results',{recursive:true});
const browser=await chromium.launch({args:['--enable-gpu','--use-angle=d3d11','--disable-software-rasterizer']});
try{
  const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:5173/game.html');
  await page.locator('#new-save').click();
  await page.waitForFunction(()=>window.gameDemo?.ready,null,{timeout:90000});
  await page.evaluate(()=>{gameDemo.renderer.setAnimationLoop(null);gameDemo.voices.setMuted(true);});
  await page.evaluate(()=>{for(let i=0;i<60;i++)gameDemo.frame(1/60);});
  await page.screenshot({path:'test-results/creator-opening.png'});
  await page.locator('#enter').click();
  for(const time of [3,8,14,19,22.5,23.25,30,33,36,39,44,50,60,66,70,74.1]){
    await page.evaluate(t=>{while(gameDemo.opening.time<t&&gameDemo.state.mode==='opening')gameDemo.frame(1/30);gameDemo.frame(1/60);},time);
    await page.screenshot({path:`test-results/opening-${time}.png`});
    if(time<17)assert.equal(await page.evaluate(()=>gameDemo.opening.street.car.visible),false,'Approaching car hidden before crossing');
    if(time>=19&&time<23.3)assert.equal(await page.evaluate(()=>gameDemo.opening.street.car.visible),true,'Approaching car enters with crossing');
    console.log('shot',time,await page.evaluate(()=>({mode:gameDemo.state.mode,shot:gameDemo.opening.shot,triangles:gameDemo.renderer.info.render.triangles})));
  }
  await writeFile('test-results/opening-preview.json',JSON.stringify({errors},null,2));
  assert.deepEqual(errors,[]);
  console.log({errors});
}finally{await browser.close();}


