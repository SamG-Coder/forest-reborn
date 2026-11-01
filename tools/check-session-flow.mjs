import {chromium, expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';

await mkdir('test-results', {recursive:true});
const browser = await chromium.launch({args:['--enable-gpu','--use-angle=d3d11','--disable-software-rasterizer']});
const errors = [], checks = [];
try {
  const page = await browser.newPage({viewport:{width:1600,height:1000}});
  page.on('pageerror', error => errors.push(error.message));
  const ready = async () => {
    await page.waitForFunction(() => window.gameDemo?.ready, null, {timeout:90000});
    await page.evaluate(() => {gameDemo.renderer.setAnimationLoop(null);gameDemo.state.mute=true;gameDemo.voices.setMuted(true); for(let i=0;i<30;i++)gameDemo.frame(1/60);});
  };
  const logOff = async () => {
    await page.locator('#game-menu-button').click();
    await expect(page.locator('#log-off')).toBeVisible();
    await page.locator('#log-off').click();
    await expect(page.locator('#save-screen')).toBeVisible();
  };
  await page.goto('http://127.0.0.1:5173/game.html');
  await expect(page.locator('#new-save')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({path:'test-results/menu-new.png'});
  await page.locator('#new-save').click(); await ready();
  await page.locator('#character-name').fill('Arin');
  await page.locator('#body-type').selectOption('female');
  assert.equal(await page.locator('#hair option').count(), 12);
  await page.locator('#enter').click();
  for (const time of [3,14,30,74.1]) {
    await page.evaluate(t => {while(gameDemo.opening.time<t && gameDemo.state.mode==='opening')gameDemo.frame(1/30);gameDemo.frame(1/60);}, time);
    await page.screenshot({path:`test-results/session-opening-${time}.png`});
  }
  assert.equal(await page.evaluate(() => gameDemo.state.mode), 'play');
  checks.push('Creator, full opening and wake complete');
  const expected = await page.evaluate(() => {
    const g=gameDemo;g.progress.recordKill('rabbit');g.progress.data.coins+=37;
    g.player.position.x+=1.3;g.player.position.z+=.8;g.frame(1/60);
    return {id:g.session.entry.id,x:g.player.position.x,z:g.player.position.z,data:structuredClone(g.progress.data)};
  });
  await page.locator('#game-menu-button').click();
  assert.equal(await page.evaluate(() => gameDemo.state.paused&&!gameDemo.input.enabled), true);
  const paused = await page.evaluate(() => {
    const g=gameDemo,before=g.population.residents.map(p=>p.target.root.position.toArray());
    for(let i=0;i<120;i++)g.frame(1/60);
    return {same:JSON.stringify(before)===JSON.stringify(g.population.residents.map(p=>p.target.root.position.toArray())),keys:g.input.keys.size};
  });
  assert.equal(paused.same,true);
  await page.keyboard.press('b');
  assert.equal(await page.evaluate(() => gameDemo.input.keys.size),0);
  await page.screenshot({path:'test-results/menu-in-game.png'});
  // Failed storage must leave the game open, allowing the user to retry.
  await page.evaluate(() => {window.originalSlotWrite=gameDemo.session.storage.setItem;gameDemo.session.storage.setItem=()=>{throw new Error('Storage full (test)');};});
  await page.locator('#log-off').click();
  await expect(page.locator('.game-menu-save-status')).toContainText('Could not save');
  await page.evaluate(() => {gameDemo.session.storage.setItem=window.originalSlotWrite;});
  await page.locator('#save-game').click();
  await expect(page.locator('.game-menu-save-status')).toHaveText('Progress saved.');
  await page.locator('#log-off').click();
  await expect(page.locator('#save-screen')).toBeVisible();
  await expect(page.locator('.menu-status')).toContainText('logged off');
  await page.screenshot({path:'test-results/menu-saved.png'});
  await page.locator(`[data-continue-save="${expected.id}"]`).click();await ready();
  const resumed=await page.evaluate(()=>({mode:gameDemo.state.mode,name:gameDemo.appearance.name,x:gameDemo.player.position.x,z:gameDemo.player.position.z,data:gameDemo.progress.data}));
  assert.equal(resumed.mode,'play');assert.equal(resumed.name,'Arin');
  assert.equal(resumed.x,expected.x);assert.equal(resumed.z,expected.z);
  for(const key of ['coins','xp','level','bag','skills','equipped','kills'])assert.deepEqual(resumed.data[key],expected.data[key],key);
  checks.push('Log off preserves position, items, equipment, XP and skills; storage error prevents exit');
  await logOff();await page.locator('#new-save').click();await ready();
  await page.locator('#character-name').fill('Kellan');
  assert.equal(await page.locator('#hair option').count(),12);
  await page.locator('#enter').click();await page.locator('#skip-opening').click();
  const second=await page.evaluate(()=>({id:gameDemo.session.entry.id,mode:gameDemo.state.mode,coins:gameDemo.progress.data.coins,xp:gameDemo.progress.data.xp,gear:gameDemo.progress.data.equipped}));
  assert.notEqual(second.id,expected.id);assert.equal(second.mode,'play');assert.equal(second.coins,0);assert.equal(second.xp,0);assert.deepEqual(second.gear,['legs.starter']);
  await logOff();await expect(page.locator('.save-card')).toHaveCount(2);
  await page.screenshot({path:'test-results/menu-two-characters.png'});
  await page.setViewportSize({width:1280,height:720});await page.screenshot({path:'test-results/menu-720p.png'});
  await page.locator('.menu-link').filter({hasText:'Rename save'}).click();
  await page.locator('.menu-dialog input').fill('Second journey');await page.getByRole('button',{name:'Save name',exact:true}).click();
  await page.locator('.menu-link').filter({hasText:'Delete save'}).click();
  await page.getByRole('button',{name:'Delete this save',exact:true}).click();
  await expect(page.locator('.save-card')).toHaveCount(1);
  assert.equal(await page.locator('.save-card').getAttribute('data-save-id'),expected.id);
  checks.push('Second character isolated; skip opening, rename and delete leave first save intact');
  assert.deepEqual(errors,[]);
  console.log({checks,errors});
} finally {
  await writeFile('test-results/session-flow.json',JSON.stringify({checks,errors},null,2));
  await browser.close();
}


