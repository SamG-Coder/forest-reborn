import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const browser=await chromium.launch({args:['--enable-gpu','--use-angle=d3d11','--disable-software-rasterizer']});
const page=await browser.newPage({viewport:{width:1500,height:1000}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.goto('http://127.0.0.1:5173/crowd.html');await page.waitForFunction(()=>window.crowdLab?.ready);await page.waitForTimeout(1500);
const results=[];
for(const count of [100,1000,5000]){
  await page.selectOption('#count',String(count));await page.waitForTimeout(500);
  results.push(await page.evaluate(()=>crowdLab.measure(10)));
}
const first=createHash('sha256').update(await page.locator('canvas').screenshot()).digest('hex');await page.waitForTimeout(500);
const second=createHash('sha256').update(await page.locator('canvas').screenshot()).digest('hex');assert.notEqual(first,second,'GPU animation changes actual rendered canvas');
await page.screenshot({path:'test-results/crowd-5000.png'});
await page.click('#ground');await page.waitForTimeout(800);const ground=await page.evaluate(()=>crowdLab.measure(5));
assert.equal(results[2].visible,5000);assert.deepEqual(errors,[]);
await mkdir('public/validation/gear',{recursive:true});await writeFile('public/validation/gear/crowd-benchmark.json',JSON.stringify({results,ground,animationChangesCanvas:first!==second,errors,scope:'Headless Chromium WebGL2 D3D11, one outfit, vertex-colour LODs, GPU-skinned idle/walk/run. No NPC AI, network, shadows or live cloth.'},null,2));
console.log(JSON.stringify({results,ground,errors},null,2));await browser.close();
