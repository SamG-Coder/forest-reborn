import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';

const browser=await chromium.launch({args:['--enable-gpu','--use-angle=d3d11','--disable-software-rasterizer']});
try{
  const page=await browser.newPage({viewport:{width:1440,height:960}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://127.0.0.1:5173/game.html');
  await page.waitForFunction(()=>window.gameDemo?.ready,null,{timeout:60000});
  await page.evaluate(()=>gameDemo.renderer.setAnimationLoop(null));
  await page.click('#enter');
  const frame=async(count=1)=>page.evaluate(count=>{for(let i=0;i<count;i++)gameDemo.frame(1/60);},count);
  async function selectPerson(id){
    await page.evaluate(id=>{
      const g=gameDemo,person=g.population.residents.find(person=>person.id===id);
      g.selectEnemy(null);g.player.position.copy(person.position);g.player.position.z+=2.4;
      g.player.position.y=g.world.height(g.player.position.x,g.player.position.z);g.player.velocity.set(0,0,0);
      g.state.cameraYaw=0;g.state.cameraPitch=.32;g.state.cameraDistance=4.5;g.player.yaw=Math.PI;
    },id);
    await frame(40);
    const point=await page.evaluate(id=>{
      const p=gameDemo.population.residents.find(person=>person.id===id).position.clone();p.y+=1.25;p.project(gameDemo.camera);
      return {x:(p.x*.5+.5)*innerWidth,y:(-.5*p.y+.5)*innerHeight};
    },id);
    await page.mouse.click(point.x,point.y);await frame();
    assert.equal(await page.evaluate(()=>gameDemo.state.friendly?.id),id);
    assert.equal(await page.evaluate(()=>gameDemo.state.autoAttack),false);
  }
  await selectPerson('smith');
  assert.equal(await page.locator('#target-card').getAttribute('data-kind'),'npc');
  assert.match(await page.locator('#target-kind').innerText(),/NPC · SMITH/);
  assert.equal(await page.locator('#unit-interact').innerText(),'Talk');
  await page.screenshot({path:'test-results/mmo-npc-card.png'});
  await page.click('#unit-interact');assert.equal(await page.locator('.world-panel').getAttribute('data-kind'),'npc');
  assert.match(await page.locator('.panel-body').innerText(),/Mind the sparks/);await page.click('.panel-close');

  await selectPerson('adventurer-8');
  assert.equal(await page.locator('#target-card').getAttribute('data-kind'),'player');
  assert.match(await page.locator('#target-kind').innerText(),/PLAYER/);
  await page.click('#unit-interact');await frame();
  assert.equal(await page.evaluate(()=>gameDemo.simulation.friends.has(8)),true);
  assert.equal(await page.locator('#unit-interact').innerText(),'Remove friend');
  await page.screenshot({path:'test-results/mmo-player-card.png'});
  await page.click('[data-panel="friends"]');assert.match(await page.locator('.panel-body').innerText(),/Luca/);await page.click('.panel-close');

  const before=await page.evaluate(()=>{
    const g=gameDemo,node=g.world.resources.ledger.nodes.find(n=>n.kind==='herbs'&&n.remaining===3);
    g.player.position.set(node.x,g.world.height(node.x,node.z+1),node.z+1);g.player.velocity.set(0,0,0);g.selectEnemy(null);
    return {id:node.id,stock:g.simulation.stock.herbs??0,coins:g.progress.data.coins};
  });
  await frame();assert.match(await page.locator('.talk-prompt').innerText(),/Gather herbs/);
  await page.keyboard.press('KeyV');await frame(160);
  assert.equal(await page.evaluate(()=>gameDemo.progress.data.inventory.herbs),1);
  assert.equal(await page.evaluate(id=>gameDemo.world.resources.ledger.nodes.find(n=>n.id===id).remaining,before.id),2);
  await selectPerson('trader');await page.click('#unit-interact');
  await page.getByRole('button',{name:'Sell gathered materials',exact:true}).click();
  assert.equal(await page.evaluate(()=>gameDemo.progress.data.coins),before.coins+3);
  assert.equal(await page.evaluate(()=>gameDemo.simulation.stock.herbs),before.stock+1);
  assert.deepEqual(await page.evaluate(()=>gameDemo.progress.data.inventory),{});
  await page.click('.panel-close');await frame();
  await page.screenshot({path:'test-results/mmo-market.png'});
  assert.deepEqual(errors,[]);
  const report={npcCard:'click selects NPC; role and Talk open correct dialogue',playerCard:'click selects Player; Add friend updates Friends and target card',gather:'V depletes shared herb node and adds carried herb',trade:'Orin transfers herb to shared stock and pays 3 coins',errors};
  await writeFile('test-results/mmo-ui.json',JSON.stringify(report,null,2));console.log(report);
}finally{await browser.close();}
