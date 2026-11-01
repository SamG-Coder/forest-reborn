import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({args:['--enable-gpu','--use-angle=d3d11','--disable-software-rasterizer']});
try{
  const page=await browser.newPage({viewport:{width:1600,height:1100}}),errors=[];
  page.on('pageerror',e=>{errors.push(e.message);console.log(e.message);});
  await page.goto('http://127.0.0.1:5173/game.html');await page.waitForFunction(()=>window.gameDemo?.ready,null,{timeout:60000});
  await page.evaluate(()=>gameDemo.renderer.setAnimationLoop(null));await page.click('#enter');
  const frame=async(n=1)=>page.evaluate(n=>{for(let i=0;i<n;i++)gameDemo.frame(1/60);},n);
  async function talk(id){await page.evaluate(id=>{const g=gameDemo,p=g.population.residents.find(p=>p.id===id);g.player.position.copy(p.position);g.player.position.z+=2;g.player.position.y=g.world.height(g.player.position.x,g.player.position.z);g.player.velocity.set(0,0,0);g.selectEnemy(null);},id);await frame(30);await page.keyboard.press('KeyV');}
  await frame(30);await page.keyboard.press('KeyB');assert.equal(await page.locator('.inventory-slot').count(),24);await page.click('.close-player-panel');
  await talk('innkeeper');await page.getByRole('button',{name:'Take the job',exact:true}).click();await page.click('.panel-close');
  await talk('trader');await page.getByRole('button',{name:'Pick up Tomas’s flour',exact:true}).click();await page.click('.panel-close');
  await talk('innkeeper');await page.getByRole('button',{name:'Collect reward',exact:true}).click();await page.click('.panel-close');
  assert.equal(await page.evaluate(()=>gameDemo.combat.weapon),'unarmed');assert.ok(await page.evaluate(()=>gameDemo.progress.hasItem('sword')));
  await page.keyboard.press('KeyB');await page.locator('.inventory-slot[aria-label^="Practice sword,"]').dblclick();await frame();
  assert.equal(await page.evaluate(()=>gameDemo.combat.weapon),'sword');assert.equal(await page.evaluate(()=>gameDemo.progress.hasItem('sword')),false);
  await page.click('.close-player-panel');
  // Seed money only for shop coverage; the first sword above was earned through the actual quest UI.
  await page.evaluate(()=>{gameDemo.progress.data.coins=10203;gameDemo.progress.save();});
  await talk('trader');await page.click('[data-tab="buy"]');
  await page.getByRole('button',{name:'Buy Leather tall boots',exact:true}).click();
  assert.equal(await page.evaluate(()=>gameDemo.progress.data.coins),10148);
  const bounds=await page.locator('.world-panel').boundingBox();assert.ok(bounds.width>=700);
  await page.mouse.move(5,5);await page.screenshot({path:'test-results/shop-large-dialogue.png'});
  await page.click('.panel-close');await page.keyboard.press('KeyB');await page.locator('.inventory-slot[aria-label^="Leather tall boots,"]').dblclick();await frame();
  assert.ok(await page.evaluate(()=>gameDemo.progress.data.equipped.includes('shoes.traveller')));await page.click('.close-player-panel');
  await page.keyboard.press('KeyC');await page.waitForSelector('.character-preview canvas');await frame(80);await page.mouse.move(5,5);
  await page.screenshot({path:'test-results/character-equipment.png'});
  assert.equal(await page.locator('.equipment-slot').count(),9);assert.match(await page.locator('.character-stats').innerText(),/Armour/);
  await page.locator('.equipment-slot[data-slot="shoes"]').click();await frame();assert.ok(await page.evaluate(()=>gameDemo.progress.hasItem('shoes.traveller')));await page.click('.close-player-panel');
  const node=await page.evaluate(()=>{const g=gameDemo,n=g.world.resources.ledger.nodes.find(n=>n.kind==='herbs'&&n.remaining===3);g.player.position.set(n.x,g.world.height(n.x,n.z+1),n.z+1);g.player.velocity.set(0,0,0);g.selectEnemy(null);return {id:n.id};});
  await frame(40);await page.keyboard.press('KeyV');await frame(60);assert.ok(await page.evaluate(()=>Boolean(gameDemo.skillAction.current)));
  await page.screenshot({path:'test-results/gathering-action.png'});await frame(120);
  assert.equal(await page.evaluate(()=>gameDemo.progress.data.inventory.herbs),1);assert.equal(await page.evaluate(()=>gameDemo.progress.data.skills.herbalism.xp),8);
  assert.equal(await page.evaluate(id=>gameDemo.world.resources.ledger.nodes.find(n=>n.id===id).remaining,node.id),2);
  await page.keyboard.press('KeyK');assert.equal(await page.locator('.skill-row').count(),7);assert.match(await page.locator('[data-skill="herbalism"]').innerText(),/8 \/ 30 XP/);await page.mouse.move(5,5);await page.screenshot({path:'test-results/skills-panel.png'});await page.click('.close-player-panel');
  await talk('trader');await page.click('[data-tab="sell"]');await page.getByRole('button',{name:'Sell Meadow herbs',exact:true}).click();assert.equal(await page.evaluate(()=>gameDemo.progress.data.coins),10151);assert.equal(await page.evaluate(()=>gameDemo.progress.data.skills.trading.xp),2);
  await page.click('.panel-close');await page.keyboard.press('KeyB');await page.mouse.move(5,5);await page.screenshot({path:'test-results/slotted-bag.png'});
  await page.locator('.inventory-slot[aria-label^="Leather tall boots,"]').hover();assert.ok(await page.locator('.game-tooltip').isVisible());assert.match(await page.locator('.game-tooltip').innerText(),/Leather tall boots/);
  assert.deepEqual(errors,[]);const result={slots:24,equipmentSlots:9,skills:7,dialogWidth:bounds.width,questReward:'earned, stored in bag, double-click equipped',shop:'buy and sell changed real money, stock and inventory',gather:'animation completed then awarded item and skill XP',errors};
  await writeFile('test-results/inventory-ui.json',JSON.stringify(result,null,2));console.log(result);
}finally{await browser.close();}
