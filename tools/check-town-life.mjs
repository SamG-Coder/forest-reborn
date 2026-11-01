import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
await mkdir('test-results/town-life',{recursive:true});
const browser=await chromium.launch({args:['--enable-gpu','--use-angle=d3d11']});
try{
  const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[];
  page.on('pageerror',e=>{errors.push(e.stack);console.log(e.stack);});
  await page.goto('http://127.0.0.1:5173/');await page.locator('#new-save').click();
  await page.waitForFunction(()=>window.gameDemo?.ready,null,{timeout:120000});
  await page.evaluate(()=>{const g=gameDemo;g.voices.setMuted(true);g.enter();g.opening.finish();g.dev.teleport(850,-798);g.dev.time(10);g.state.cameraYaw=0;g.state.cameraDistance=7;g.state.cameraPitch=.17;});
  await page.waitForFunction(()=>gameDemo.expansion.zones.get('highmere'),null,{timeout:120000});
  await page.waitForTimeout(1800);
  await page.screenshot({path:'test-results/town-life/highmere-day.png'});
  await page.keyboard.press('Enter');await page.locator('[aria-label="Chat message"]').fill('/devui');await page.keyboard.press('Enter');assert.ok(await page.locator('.developer-panel').isVisible());
  await page.screenshot({path:'test-results/town-life/dev-ui.png'});
  await page.locator('.developer-panel .window-close').click();
  await page.evaluate(()=>{gameDemo.dev.time(23);gameDemo.renderer.setAnimationLoop(null);for(const c of Object.values(gameDemo.townLife.director.save.camps))c.nextAt=1e9;});
  for(let batch=0;batch<160;batch++){await page.evaluate(()=>{const g=gameDemo;for(let i=0;i<25;i++){g.world.update(i*.1,g.player.position,.1);}g.dayNight.update(0,g.player.position);g.frame(.016);});await page.waitForTimeout(25);}
  await page.screenshot({path:'test-results/town-life/highmere-night.png'});
  const result=await page.evaluate(()=>({town:gameDemo.expansion.zones.get('highmere').stats(),lights:gameDemo.dayNight.stats(),people:gameDemo.expansion.zones.get('highmere').residents.map(p=>({id:p.id,mode:p.daily.mode,sleeping:p.sleeping,position:p.position.toArray(),activity:p.activity,pathFailed:p.pathFailedFor,bed:p.daily.bed.position.toArray(),route:gameDemo.population.navigation.route(p.position,p.daily.bed.position).length,walkable:gameDemo.population.navigation.walkable(p.position.x,p.position.z)})),camps:gameDemo.townLife.stats()}));
  result.errors=errors;await writeFile('test-results/town-life/state.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
  assert.equal(errors.length,0);assert.ok(result.town.sleeping>0);assert.equal(result.town.guardsOnDuty,4);
}finally{await browser.close();}
