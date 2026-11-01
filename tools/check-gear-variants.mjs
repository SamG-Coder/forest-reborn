import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';

const browser=await chromium.launch({args:['--enable-gpu','--use-angle=d3d11','--disable-software-rasterizer']});
try{
  const page=await browser.newPage({viewport:{width:1500,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto('http://127.0.0.1:5173/gear.html');await page.waitForFunction(()=>window.gearLab?.ready);
  await page.evaluate(()=>{gearLab.renderer.setAnimationLoop(null);gearLab.setMode('idle');});
  await page.selectOption('[data-variation=clothFinish]','brocade');
  await page.selectOption('[data-variation=metalFinish]','engraved');
  const metals=[];
  for(const metal of ['iron','steel','copper','bronze','silver','mithril']){
    await page.click(`[data-metal=${metal}]`);
    const record=await page.evaluate(()=>{
      const g=gearLab;for(let i=0;i<30;i++)g.advance(1/60);g.renderer.render(g.scene,g.camera);
      const item=g.equipment.entries.get('body');
      return {id:g.variations.id,resource:item.definition.resource,color:item.meshes[0].material.color.getHexString(),texture:item.meshes[0].material.map.image.src};
    });metals.push(record);assert.equal(record.resource,metal);assert.match(record.texture,/engraved/);
    await page.locator('canvas').screenshot({path:`test-results/metal-${metal}.png`});
  }
  assert.equal(new Set(metals.map(m=>m.color)).size,6);
  const before=await page.evaluate(()=>gearLab.avatar.body.geometry.index.count);
  for(const key of ['helmet','frontPanel','backPanel','belt','trim','shoulderLeft','shoulderRight','necklace','ringLeft','ringRight'])await page.uncheck(`[data-part=${key}]`);
  const off=await page.evaluate(()=>({body:gearLab.avatar.body.geometry.index.count,slots:[...gearLab.equipment.entries.keys()],parts:[...gearLab.equipment.entries.values()].flatMap(e=>e.meshes.filter(m=>m.visible).map(m=>m.userData.part))}));
  assert.ok(off.body>before);assert.ok(!off.slots.includes('head'));
  for(const part of ['panel-front','panel-back','waist-belt','buckle','shoulder-L','shoulder-R','rim','rivet'])assert.ok(!off.parts.includes(part),part);
  for(const key of ['helmet','frontPanel','backPanel','belt','trim','shoulderLeft','shoulderRight','necklace','ringLeft','ringRight'])await page.check(`[data-part=${key}]`);
  assert.equal(await page.evaluate(()=>gearLab.avatar.body.geometry.index.count),before);
  await page.uncheck('[data-part=helmet]');await page.uncheck('[data-part=shoulderLeft]');
  await page.selectOption('[data-variation=dye]','red');
  const recipe=await page.inputValue('[data-recipe]');
  await page.click('[data-load]');assert.equal(await page.inputValue('[data-recipe]'),recipe);
  await page.evaluate(()=>{gearLab.renderer.render(gearLab.scene,gearLab.camera);});await page.screenshot({path:'test-results/gear-variants.png'});
  const ids=await page.evaluate(()=>gearLab.equipment.ids());
  await page.click('[data-save]');
  await page.goto('http://127.0.0.1:5173/game.html');await page.waitForFunction(()=>window.gameDemo?.ready,null,{timeout:60000});
  assert.deepEqual(await page.evaluate(()=>gameDemo.wardrobe.ids()),['legs.starter']);
  assert.equal(await page.evaluate(()=>gameDemo.combat.weapon),'unarmed');
  await page.click('#enter');
  const start=await page.evaluate(()=>gameDemo.player.position.toArray());
  await page.keyboard.down('KeyW');await page.waitForTimeout(900);await page.keyboard.up('KeyW');
  assert.ok(await page.evaluate(start=>gameDemo.player.position.distanceTo({x:start[0],y:start[1],z:start[2]})>.4,start));
  await page.keyboard.press('Space');await page.waitForTimeout(220);assert.equal(await page.evaluate(()=>gameDemo.player.grounded),false);
  await page.waitForTimeout(1000);assert.equal(await page.evaluate(()=>gameDemo.player.grounded),true);
  await page.keyboard.down('KeyJ');await page.waitForTimeout(1100);await page.keyboard.up('KeyJ');await page.waitForTimeout(300);
  await page.screenshot({path:'test-results/game-variant-attack.png'});
  await page.waitForTimeout(1000);
  const stats=await page.evaluate(()=>gameDemo.wardrobe.stats());assert.ok(Number.isFinite(stats.maxStretch));
  assert.deepEqual(errors,[]);
  await writeFile('public/validation/gear/variants-check.json',JSON.stringify({metals,recipe,slotsOff:off.slots,maskRestored:true,labOutfitCannotBypassProgression:true,walking:true,jumpLanding:true,stats,errors},null,2));
  console.log({metals:metals.length,recipe,maskRestored:true,labOutfitCannotBypassProgression:true,walking:true,jumpLanding:true,errors});
}finally{await browser.close();}
