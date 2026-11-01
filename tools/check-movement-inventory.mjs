import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
await mkdir('test-results/ui',{recursive:true});
const browser=await chromium.launch({args:['--enable-gpu','--use-angle=d3d11']});
try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto('http://127.0.0.1:5173/');await page.locator('#new-save').click();await page.waitForFunction(()=>window.gameDemo?.ready,null,{timeout:120000});
  await page.evaluate(()=>{const g=gameDemo;g.renderer.setAnimationLoop(null);g.voices.setMuted(true);g.enter();g.opening.finish();g.player.position.set(4,g.world.height(4,-80),-80);g.player.yaw=Math.PI;g.progress.data.level=15;g.progress.addItem('weapon.sabre');g.weapon('weapon.sabre');g.frame(.016);});
  await page.keyboard.down('Shift');await page.keyboard.down('w');
  const chase=await page.evaluate(()=>{
    const g=gameDemo;for(let i=0;i<30;i++)g.frame(1/60);
    const freeSpeed=g.player.speed,target=g.world.targets.find(t=>t.kind==='goblin');target.dormant=true;target.hp=target.maxHp=500;target.aggro=false;g.combat.random=()=>1;
    target.position.copy(g.player.position);target.position.z-=1.7;g.selectEnemy(target);g.state.autoAttack=true;
    const start=g.player.position.clone();let minimum=100;
    for(let i=0;i<120;i++){target.position.copy(g.player.position);target.position.z-=1.7+3.9/60;g.frame(1/60);minimum=Math.min(minimum,g.player.speed);}
    const result={freeSpeed,minimum,distance:g.player.position.distanceTo(start),damage:500-target.hp};g.selectEnemy(null);g.combat.stamina=0;for(let i=0;i<20;i++)g.frame(1/60);result.exhaustedSpeed=g.player.speed;return result;
  });
  assert.ok(chase.minimum>3.85);assert.ok(chase.damage>0);assert.ok(chase.exhaustedSpeed>3.85);
  await page.keyboard.up('w');await page.keyboard.up('Shift');await page.keyboard.press('NumLock');
  const autorun=await page.evaluate(()=>{const g=gameDemo;for(let i=0;i<30;i++)g.frame(1/60);return {active:g.input.autoRun,speed:g.player.speed,label:document.querySelector('#state-label').textContent};});
  assert.ok(autorun.active&&autorun.speed>3.85);assert.match(autorun.label,/AUTORUN/);
  await page.keyboard.press('s');assert.equal(await page.evaluate(()=>gameDemo.input.autoRun),false);
  await page.keyboard.press('NumLock');await page.keyboard.press('NumLock');assert.equal(await page.evaluate(()=>gameDemo.input.autoRun),false);
  await page.evaluate(()=>{const g=gameDemo;g.input.clear();g.player.position.set(5,g.world.height(5,10),10);g.progress.addItem('clothes.traveller-red');g.progress.addItem('head.cloth-cap');g.progress.addItem('bread',3);g.playerPanels.show('character');g.playerPanels.show('bag');g.frame(.016);});
  const bag=page.locator('.bag-window'),character=page.locator('.character-window');await bag.waitFor({state:'visible'});await character.waitFor({state:'visible'});
  const index=await page.evaluate(()=>gameDemo.progress.data.bag.findIndex(s=>s?.id==='clothes.traveller-red'));
  await bag.locator(`[data-index="${index}"]`).dragTo(character.locator('[data-slot="clothes"]'));
  assert.ok(await page.evaluate(()=>gameDemo.progress.data.equipped.includes('clothes.traveller-red')));
  const empty=await page.evaluate(()=>gameDemo.progress.data.bag.findIndex(s=>!s));
  await character.locator('[data-slot="clothes"]').dragTo(bag.locator(`[data-index="${empty}"]`));
  assert.equal(await page.evaluate(()=>gameDemo.progress.data.equipped.includes('clothes.traveller-red')),false);
  await bag.locator(`[data-index="${empty}"]`).dragTo(character.locator('.paper-doll'));
  assert.ok(await page.evaluate(()=>gameDemo.progress.data.equipped.includes('clothes.traveller-red')));
  // The preview loads asynchronously; only this isolated test advances its render.
  for(let i=0;i<6;i++){await page.waitForTimeout(100);await page.evaluate(()=>gameDemo.frame(.016));}
  const dimensions=await page.evaluate(()=>Object.fromEntries(['.bag-window','.character-window'].map(s=>{const r=document.querySelector(s).getBoundingClientRect();return [s,{x:r.x,y:r.y,width:r.width,height:r.height}];})));
  assert.ok(await character.locator('.character-stats').evaluate(list=>[...list.children].every(cell=>cell.getBoundingClientRect().right<=list.getBoundingClientRect().right+1)),'Stats stay inside the frame');
  assert.ok(dimensions['.bag-window'].width<=380);await page.mouse.move(1000,600);await page.screenshot({path:'test-results/ui/equipment-bags.png'});
  await page.keyboard.press('b');assert.ok(await bag.isHidden());assert.ok(await character.isVisible());await page.keyboard.press('b');assert.ok(await bag.isVisible());
  await page.evaluate(()=>{const g=gameDemo,target=g.world.targets.find(t=>t.kind==='rabbit');target.position.copy(g.player.position);target.position.x+=1;const r=g.population.corpses.kill(target,Date.now(),{id:'player'});r.loot={coins:14,items:[{id:'rabbitHide',count:2},{id:'bread',count:1}]};g.lootPanel.show(r);});
  await page.locator('.loot-panel').waitFor({state:'visible'});assert.ok(await bag.isVisible());
  const lootWidth=await page.locator('.loot-panel').evaluate(n=>n.getBoundingClientRect().width);assert.ok(lootWidth<=320);
  await page.screenshot({path:'test-results/ui/compact-loot.png'});
  await page.locator('.loot-panel').getByRole('button',{name:'Loot all',exact:true}).click();assert.ok(await page.locator('.loot-panel').isHidden());assert.ok(await bag.isVisible());
  assert.deepEqual(errors,[]);const result={chase,autorun,dimensions,lootWidth,errors};console.log(result);await writeFile('test-results/ui/movement-inventory.json',JSON.stringify(result,null,2));
}finally{await browser.close();}
