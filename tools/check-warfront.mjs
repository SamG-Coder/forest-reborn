import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({args:['--enable-gpu','--use-angle=d3d11']});
try{
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.setDefaultTimeout(120000);page.on('pageerror',e=>{errors.push(e.message);console.log(e.stack);});
  page.on('console',m=>{if(m.type()==='error')console.log(m.text().slice(0,600));});
  await page.goto('http://127.0.0.1:5173/');await page.locator('#new-save').click();await page.waitForFunction(()=>window.gameDemo?.ready);
  await page.evaluate(()=>{const g=gameDemo;g.renderer.setAnimationLoop(null);g.voices.setMuted(true);g.enter();if(g.state.mode==='opening')g.opening.finish();g.player.position.set(1235,0,-831);g.player.position.y=g.world.height(1235,-831);g.frame(.016);});
  await page.waitForFunction(()=>gameDemo.expansion.zones.get('highmere-field'),null,{timeout:120000});
  const result=await page.evaluate(()=>{
    const g=gameDemo,w=g.expansion.zones.get('highmere-field');g.frame(.016);
    const a=w.simulation.actors[505];g.player.position.copy(a.position);g.player.position.z+=1.8;g.progress.data.level=15;g.progress.addItem('weapon.greatsword');g.weapon('weapon.greatsword');g.combat.random=()=>1;g.combat.stamina=100;a.hp=1;g.selectEnemy(a);const attacked=g.requestAttack('sword');
    for(let i=0;i<22;i++)g.frame(.05);
    const corpse=g.population.corpses.records.get(a.id);g.saveSession();
    return {registered:w.stats().registeredNPCs,sameEntity:g.world.targets.includes(a)&&g.population.residents.some(p=>p.target===a),attacked,dead:a.hp<=0,lootOwner:corpse?.owner,saved:g.progress.data.realm.battle?.actors?.length,details:w.crowd.stats()};
  });
  console.log(result);assert.equal(result.registered,1000);assert.ok(result.sameEntity&&result.attacked&&result.dead);assert.equal(result.lootOwner,'player');assert.equal(result.saved,1000);assert.deepEqual(errors,[]);
  await page.screenshot({path:'test-results/factions/warfront-connected.png'});await writeFile('test-results/factions/warfront-connected.json',JSON.stringify({result,errors},null,2));
}finally{await browser.close();}
