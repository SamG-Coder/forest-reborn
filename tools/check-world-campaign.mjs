import {chromium} from '@playwright/test';
import {writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
await mkdir('test-results/factions',{recursive:true});
const browser=await chromium.launch({args:['--enable-gpu','--use-angle=d3d11']});
try{
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
  page.setDefaultTimeout(180000);page.on('pageerror',e=>{errors.push(e.message);console.log(e.stack);});
  page.on('console',m=>{if(m.type()==='error'){errors.push(m.text());console.log(m.text().slice(0,400));}});
  await page.goto('http://127.0.0.1:5173/');await page.locator('#new-save').click();await page.waitForFunction(()=>window.gameDemo?.ready);
  await page.evaluate(()=>{const g=gameDemo;g.renderer.setAnimationLoop(null);g.voices.setMuted(true);g.enter();g.opening.finish();g.state.mute=true;g.progress.data.worldFlags.beaconLit=true;g.progress.data.quests['road-beacon']={completed:true};g.expansion.director.update(.1);g.progress.accept('northern-stand');g.expansion.joinCampaign();});
  await page.waitForFunction(()=>gameDemo.expansion.zones.get('northern-battle'));
  await page.evaluate(()=>{const g=gameDemo;g.frame(.016);for(let i=0;i<70;i++)g.frame(.05);});
  await page.screenshot({path:'test-results/factions/campaign-opening.png'});
  const setup=await page.evaluate(()=>{
    const g=gameDemo,w=g.expansion.zones.get('northern-battle');g.expansion.cinematic.finish();g.frame(.016);
    const a=w.enemies.find(a=>a.mounted);g.camera.position.copy(a.position).add(new a.position.constructor(7,4,7));g.camera.lookAt(a.position.clone().add(new a.position.constructor(0,1.5,0)));w.crowd.update(g.camera,w.simulation.time,.016);g.renderer.render(g.scene,g.camera);
    return {count:w.enemies.length,unique:new Set(w.enemies.map(a=>a.id)).size,mounted:w.enemies.filter(a=>a.mounted).length,shared:w.enemies.every(a=>g.population.targets.includes(a)&&g.world.targets.includes(a)&&a.person.target===a),details:w.crowd.stats(),stages:g.expansion.director.save.campaign};
  });
  console.log('setup',setup);assert.equal(setup.count,10000);assert.equal(setup.unique,10000);assert.ok(setup.shared&&setup.mounted>0);
  await page.screenshot({path:'test-results/factions/campaign-cavalry.png'});
  const run=await page.evaluate(async()=>{
    const g=gameDemo,w=g.expansion.zones.get('northern-battle'),V=g.player.position.constructor;
    g.camera.position.set(1240,w.height(1240,-1270)+55,-1220);g.camera.lookAt(1270,w.height(1270,-1310)+2,-1310);g.player.position.set(1035,w.height(1035,-1270),-1270);
    const frames=[];let previous=performance.now();
    for(let i=0;i<240;i++){await new Promise(requestAnimationFrame);const now=performance.now();if(i>40)frames.push(now-previous);previous=now;w.update(.05,g.player.position);g.renderer.render(g.scene,g.camera);}
    g.saveSession();const packed=g.progress.data.realm.warfare.events['northern-battle'].packed;
    frames.sort((a,b)=>a-b);return {stats:w.stats(),mean:frames.reduce((a,b)=>a+b,0)/frames.length,p95:frames[Math.floor(frames.length*.95)],packedBytes:packed.length,draws:g.renderer.info.render.calls,triangles:g.renderer.info.render.triangles};
  });
  console.log('run',run);assert.ok(run.packedBytes<4000000);assert.ok(run.stats.hits>0);
  await page.screenshot({path:'test-results/factions/campaign-battle.png'});
  const profiler=await page.context().newCDPSession(page);await profiler.send('Profiler.enable');await profiler.send('Profiler.start');
  const gameplay=await page.evaluate(async()=>{
    const g=gameDemo,w=g.expansion.zones.get('northern-battle');g.state.cameraDistance=7;g.player.position.set(1270,w.height(1270,-1310),-1310);g.combat.hp=100;
    const samples=[];let previous=performance.now();
    // Diagnostic immortality only: keep all world/combat/AI work running while
    // preventing respawn from moving the measurement back to Mosswake.
    const receive=g.combat.receive;g.combat.receive=function(...args){const result=receive.apply(this,args);this.hp=100;return result;};
    for(let i=0;i<180;i++){await new Promise(requestAnimationFrame);const now=performance.now(),dt=Math.min(.05,(now-previous)/1000);if(i>40)samples.push(now-previous);previous=now;g.frame(dt);}
    g.combat.receive=receive;
    samples.sort((a,b)=>a-b);return {mean:samples.reduce((a,b)=>a+b,0)/samples.length,p95:samples[Math.floor(samples.length*.95)],position:g.player.position.toArray(),crowd:w.crowd.stats(),draws:g.renderer.info.render.calls,triangles:g.renderer.info.render.triangles};
  });console.log('gameplay',gameplay);await page.screenshot({path:'test-results/factions/campaign-gameplay.png'});
  const {profile}=await profiler.send('Profiler.stop');await writeFile('test-results/factions/campaign-gameplay.cpuprofile',JSON.stringify(profile));
  assert.deepEqual(errors,[]);await writeFile('test-results/factions/world-campaign.json',JSON.stringify({setup,run,gameplay,errors},null,2));
}finally{await browser.close();}
