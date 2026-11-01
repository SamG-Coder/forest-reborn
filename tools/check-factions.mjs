import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const out='test-results/factions';await mkdir(out,{recursive:true});
const browser=await chromium.launch({args:['--enable-gpu','--use-angle=d3d11']});
const context=await browser.newContext({viewport:{width:1440,height:900}}),page=await context.newPage(),errors=[];
page.on('pageerror',e=>{errors.push(e.message);console.log('PAGE ERROR',e.message);});page.setDefaultTimeout(120000);
try{
  await page.goto('http://127.0.0.1:5173/');await page.locator('#new-save').click();
  await page.waitForFunction(()=>window.gameDemo?.ready);console.log('Game ready');
  await page.evaluate(()=>{const g=gameDemo;g.renderer.setAnimationLoop(null);g.voices.setMuted(true);g.enter();if(g.state.mode==='opening')g.opening.finish();g.frame(.016);});
  const profile=await page.evaluate(async()=>{
    const g=gameDemo,cpu=[],intervals=[];let previous=performance.now();
    for(let i=0;i<180;i++)await new Promise(resolve=>requestAnimationFrame(()=>{const now=performance.now();if(i>30)intervals.push(now-previous);previous=now;const t=performance.now();g.frame(1/60);if(i>30)cpu.push(performance.now()-t);resolve();}));
    const stats=a=>{a.sort((a,b)=>a-b);return {mean:a.reduce((s,n)=>s+n,0)/a.length,p95:a[Math.floor(a.length*.95)]};};
    const gl=g.renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');
    return {cpu:stats(cpu),intervals:stats(intervals),draws:g.renderer.info.render.calls,triangles:g.renderer.info.render.triangles,gpu:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):'unknown'};
  });console.log('Town profile',JSON.stringify(profile));
  await page.evaluate(()=>{gameDemo.factionPanel.show();gameDemo.frame(.016);});await page.screenshot({path:out+'/factions.png'});
  await page.evaluate(()=>{const g=gameDemo;g.factionPanel.close();g.worldUI.quests();g.frame(.016);});await page.screenshot({path:out+'/quests.png'});
  const gameplay=await page.evaluate(()=>{
    const g=gameDemo;g.worldUI.close();g.progress.data.level=12;g.progress.addItem('weapon.ember');g.weapon('weapon.ember');g.combat.stamina=100;
    const target=g.world.targets.find(t=>t.kind==='goblin');g.player.position.copy(target.position);g.player.position.z+=2;target.hp=35;g.selectEnemy(target);
    const coins=g.progress.data.coins;g.requestAttack('sword');for(let i=0;i<35;i++)g.frame(.05);
    const corpse=g.population.corpses.records.get(target.id),beforeLoot=g.progress.data.coins;
    if(corpse){g.population.corpses.update(Date.now()+1800,g.player.position);g.lootPanel.show(corpse);}
    return {coins,beforeLoot,dead:target.hp<=0,corpse:Boolean(corpse),owner:corpse?.owner,loot:corpse?.loot,weapon:g.combat.weapon,model:g.equipment.sword.children.map(c=>c.name)};
  });console.log('Death and loot',JSON.stringify(gameplay));assert.ok(gameplay.dead&&gameplay.corpse);assert.equal(gameplay.owner,'player');
  await page.screenshot({path:out+'/loot.png'});
  await page.evaluate(()=>{const g=gameDemo;g.lootPanel.close();const p=g.population.residents.find(p=>p.id==='briar-envoy');g.player.position.copy(p.position);g.player.position.z+=1.5;g.worldUI.talk(p);g.frame(.016);});await page.screenshot({path:out+'/envoy.png'});
  assert.deepEqual(errors,[]);await writeFile(out+'/game.json',JSON.stringify({profile,gameplay,errors},null,2));
  await page.goto('http://127.0.0.1:5173/battle.html');await page.waitForFunction(()=>window.battleDemo?.ready);console.log('Battle ready');
  await page.waitForTimeout(6500);await page.screenshot({path:out+'/battle.png'});
  const battle=await page.evaluate(()=>{const b=battleDemo;const stats=a=>{a=a.slice().sort((a,b)=>a-b);return {mean:a.reduce((s,n)=>s+n,0)/a.length,p95:a[Math.floor(a.length*.95)]};};return {simulation:b.simulation.stats(),cpu:stats(b.report.samples.slice(30)),frames:stats(b.report.frames.slice(30)),graphics:b.crowd.stats(),calls:b.renderer.info.render.calls};});
  console.log(JSON.stringify(battle));assert.equal(battle.simulation.combatants,1000);assert.ok(battle.simulation.hits>0);assert.deepEqual(errors,[]);
  await writeFile(out+'/battle.json',JSON.stringify(battle,null,2));
}finally{await browser.close();}
