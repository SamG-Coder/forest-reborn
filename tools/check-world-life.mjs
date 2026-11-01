import {chromium} from '@playwright/test';
import {writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
await mkdir('test-results/factions',{recursive:true});
const browser=await chromium.launch({args:['--enable-gpu','--use-angle=d3d11']});
try{
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
  page.setDefaultTimeout(180000);page.on('pageerror',e=>{errors.push(e.stack);console.log(e.stack);});
  await page.goto('http://127.0.0.1:5173/');await page.locator('#new-save').click();await page.waitForFunction(()=>window.gameDemo?.ready);
  await page.evaluate(()=>{const g=gameDemo;g.renderer.setAnimationLoop(null);g.voices.setMuted(true);g.enter();g.opening.finish();g.state.mute=true;});
  const journeys=await page.evaluate(()=>{
    const g=gameDemo,now=Date.now(),observer=g.player.position;
    for(let i=0;i<1600;i++)g.population.update(.1,observer,now+i*100,false);
    return g.population.residents.filter(p=>p.questJourney).map(p=>({id:p.id,position:p.position.toArray(),phase:p.data.journey.phase,quest:p.data.journey.quest,party:p.data.journey.party,completed:p.data.journey.completed??0,errand:p.data.questProgress?.quests.errand,activity:p.activity,pathFailed:p.pathFailedFor}));
  });console.log('journeys',JSON.stringify(journeys));assert.ok(journeys.some(p=>p.completed>0));assert.ok(journeys.every(p=>p.phase==='quests'));
  await page.evaluate(()=>{const g=gameDemo;g.player.position.set(-100,g.world.height(-100,-140),-140);g.expansion.director.begin('cart-road-raid');g.expansion.update(0,g.player.position);});
  await page.waitForFunction(()=>gameDemo.expansion.zones.get('cart-road-raid'));
  const raid=await page.evaluate(()=>{
    const g=gameDemo,w=g.expansion.zones.get('cart-road-raid'),guards=g.population.residents.filter(p=>p.type==='guard'&&!p.externalSchedule),before=guards.map(p=>p.position.clone()),now=Date.now();
    for(let i=0;i<650;i++){g.expansion.update(.1,g.player.position);g.population.update(.1,g.player.position,now+i*100,false);}
    g.camera.position.set(-119,g.world.height(-119,-144)+12,-140);g.camera.lookAt(-132,g.world.height(-132,-164)+1,-164);w.crowd.update(g.camera,w.simulation.time,.016);g.renderer.render(g.scene,g.camera);
    return {stats:w.stats(),guards:guards.map((p,i)=>({id:p.id,moved:p.position.distanceTo(before[i]),position:p.position.toArray(),activity:p.activity,failed:p.pathFailedFor,guest:w.simulation.guests.has(p.id)}))};
  });console.log('raid',JSON.stringify(raid));assert.ok(raid.guards.some(g=>g.moved>30));assert.ok(raid.guards.some(g=>g.guest));assert.ok(raid.stats.hits>0);
  await page.screenshot({path:'test-results/factions/cart-road-defence.png'});
  await page.evaluate(()=>{const g=gameDemo;g.player.position.set(1710,g.world.height(1710,-1558),-1558);g.world.update(0,g.player.position,0);});
  await page.waitForFunction(()=>gameDemo.expansion.zones.get('ashhold'));
  const fortress=await page.evaluate(()=>{
    const g=gameDemo,f=g.expansion.zones.get('ashhold');for(let i=0;i<50;i++)g.world.update(i*.016,g.player.position,.016);
    const a={x:1710,z:-1560},b={x:1710,z:-1610};
    g.camera.position.set(1702,g.world.height(1710,-1558)+12,-1532);g.camera.lookAt(1710,g.world.height(1710,-1640)+8,-1640);g.renderer.render(g.scene,g.camera);
    return {residents:f.residents.length,gateOpen:g.population.navigation.segmentClear(a,b),walkable:g.population.navigation.walkable(1710,-1579),zones:g.expansion.stats().zones.map(z=>({id:z.id,status:z.status,error:z.error}))};
  });console.log('fortress',fortress);assert.ok(fortress.gateOpen&&fortress.walkable);assert.equal(fortress.residents,8);
  await page.screenshot({path:'test-results/factions/ashhold-gate.png'});
  assert.deepEqual(errors,[]);await writeFile('test-results/factions/world-life.json',JSON.stringify({journeys,raid,fortress,errors},null,2));
}finally{await browser.close();}
