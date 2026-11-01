import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({args:['--enable-gpu','--use-angle=d3d11','--disable-software-rasterizer']});
try{
  const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[],missing=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)missing.push(r.url());});
  await page.goto('http://127.0.0.1:5173/game.html?revision=mosswake-18');await page.waitForFunction(()=>window.gameDemo?.ready,null,{timeout:60000});
  await page.evaluate(()=>{gameDemo.renderer.setAnimationLoop(null);window.testNow=Date.now();Date.now=()=>testNow;});
  const frames=async n=>page.evaluate(n=>{for(let i=0;i<n;i++){testNow+=1000/60;gameDemo.frame(1/60);}},n);
  await page.selectOption('#body-type','female');await page.selectOption('#hair','ponytail');await frames(60);
  assert.equal(await page.evaluate(()=>gameDemo.avatar.bodySystem.baseTop.visible),true);
  await page.screenshot({path:'test-results/female-starter.png'});await page.click('#enter');
  const beside=async id=>{await page.evaluate(id=>{const g=gameDemo,p=g.population.residents.find(p=>p.id===id);g.selectEnemy(null);g.player.position.copy(p.position);g.player.position.z+=1.5;g.player.position.y=g.world.height(g.player.position.x,g.player.position.z);g.player.velocity.set(0,0,0);g.followCamera.reset();},id);await frames(2);};
  // Test fixtures provide funds, never the finished equipment or shearing result.
  await page.evaluate(()=>{gameDemo.progress.data.coins=100;gameDemo.simulation.society.nextGuildAt=testNow+9999999;});
  await beside('trader');await page.keyboard.press('KeyV');await page.locator('[data-tab="buy"]').click();
  await page.getByRole('button',{name:'Buy Sheep shears',exact:true}).click();await page.locator('.panel-close').first().click();
  assert.equal(await page.evaluate(()=>gameDemo.progress.hasItem('shears')),true);
  await page.evaluate(()=>{const g=gameDemo,n=g.world.resources.ledger.nodes.find(n=>n.kind==='wool');g.player.position.set(n.x,g.world.height(n.x,n.z+1.4),n.z+1.4);g.state.cameraYaw=.9;g.state.cameraDistance=4;g.state.cameraPitch=.42;g.followCamera.reset();});await frames(3);
  await page.keyboard.press('KeyV');await frames(70);
  assert.equal(await page.evaluate(()=>gameDemo.skillAction.current?.definition.animation),'shear');
  assert.equal(await page.evaluate(()=>gameDemo.avatar.root.getObjectByName('job-shear').visible),true);
  await page.screenshot({path:'test-results/shearing-sheep.png'});await frames(190);
  assert.equal(await page.evaluate(()=>gameDemo.progress.data.inventory.wool),3);
  assert.equal(await page.evaluate(()=>gameDemo.world.resources.roots.get('sheep-1').visible),true);
  assert.equal(await page.evaluate(()=>gameDemo.world.resources.ledger.nodes.find(n=>n.id==='sheep-1').remaining),0);
  await page.evaluate(()=>gameDemo.progress.addItem('wool',15));
  async function craft(name,seconds){await page.evaluate(()=>{const g=gameDemo;g.player.position.copy(g.world.workstations.get('weaver').position);g.player.velocity.set(0,0,0);});await frames(2);await page.keyboard.press('KeyV');await page.getByRole('button',{name:'Select '+name,exact:true}).click();await page.getByRole('button',{name:'Craft '+name,exact:true}).click();await frames(Math.ceil(seconds*60)+3);}
  for(let i=0;i<6;i++)await craft('Spin wool yarn',4);
  for(let i=0;i<4;i++)await craft('Weave wool cloth',5);
  await craft('Sew traveller tunic',6);
  assert.equal(await page.evaluate(()=>gameDemo.progress.hasItem('clothes.traveller-blue')),true);
  await page.keyboard.press('KeyB');await page.getByRole('button',{name:/Traveller tunic \/ blue, 1, slot/}).dblclick();await page.locator('.close-player-panel').click();await frames(30);
  assert.equal(await page.evaluate(()=>gameDemo.avatar.bodySystem.baseTop.visible),false);
  await page.screenshot({path:'test-results/crafted-female-tunic.png'});
  await page.evaluate(()=>{const g=gameDemo;g.simulation.society.leave(2);g.progress.addItem('wood',3);});
  await beside('adventurer-2');await page.keyboard.press('KeyV');await page.getByRole('button',{name:'Add friend',exact:true}).click();
  assert.equal(await page.evaluate(()=>gameDemo.simulation.society.relationships.trust('player',2)),0);
  await page.getByRole('button',{name:'Talk for a moment',exact:true}).click();await page.getByRole('button',{name:'Offer to help',exact:true}).click();await page.getByRole('button',{name:'Finish the favour',exact:true}).click();
  await page.getByRole('textbox',{name:'Guild name',exact:true}).fill('Mosswake Companions');await page.getByRole('button',{name:'Ask to form a guild',exact:true}).click();
  assert.equal(await page.evaluate(()=>gameDemo.simulation.society.guildFor(2)?.name),'Mosswake Companions');
  await page.screenshot({path:'test-results/friendship-dialogue.png'});await page.locator('.panel-close').first().click();
  await page.evaluate(()=>{gameDemo.progress.data.level=4;});await page.keyboard.press('KeyG');await page.getByRole('button',{name:'Accept Heavy footsteps',exact:true}).click();
  await page.screenshot({path:'test-results/guild-bounty.png'});await page.getByRole('button',{name:'Close guilds and events',exact:true}).click();
  const monsters=await page.evaluate(()=>gameDemo.world.targets.filter(t=>t.kind==='ogre').map(t=>({id:t.id,hp:t.hp,scale:t.root.scale.y})));
  assert.equal(monsters.length,2);assert.ok(monsters.every(m=>m.hp===380&&m.scale>=1.6));
  for(const monster of monsters){
    await page.evaluate(id=>{const g=gameDemo,t=g.world.targets.find(t=>t.id===id);g.player.position.copy(t.position);g.player.position.z+=1.7;g.player.position.y=g.world.height(g.player.position.x,g.player.position.z);g.player.velocity.set(0,0,0);g.combat.hp=100;g.combat.stamina=100;g.combat.action=null;t.maxHp=t.hp=1;t.escapeGoal=null;g.selectEnemy(t);g.followCamera.reset();},monster.id);
    await page.click('#attack');await frames(80);
  }
  assert.equal(await page.evaluate(()=>gameDemo.simulation.society.guildFor('player').bounty.progress),2);
  await page.keyboard.press('KeyG');await page.getByRole('button',{name:'Claim bounty reward',exact:true}).click();
  assert.equal(await page.evaluate(()=>gameDemo.simulation.society.guildFor('player').bounty.claimed.includes('player')),true);
  await page.getByRole('button',{name:'Close guilds and events',exact:true}).click();
  await page.evaluate(()=>{const g=gameDemo;g.selectEnemy(null);g.player.position.set(0,g.world.height(0,70),70);Object.assign(g.progress.data.pvp,{enabled:false,wantedUntil:0,combatUntil:0,clearRequested:false});g.followCamera.reset();});await frames(2);
  await page.click('#pvp-toggle');await page.click('#pvp-toggle');await frames(1);const deadline=await page.evaluate(()=>gameDemo.progress.data.pvp.clearAt);
  await page.evaluate(()=>{testNow+=10000});await frames(1);await page.click('#pvp-toggle');
  assert.equal(await page.evaluate(()=>gameDemo.progress.data.pvp.clearAt),deadline);
  assert.match(await page.locator('.self-nameplate .pvp-status').textContent(),/20s/);
  await page.evaluate(()=>{testNow+=20000;gameDemo.progress.data.pvp.skullUntil=testNow+3600000;});await frames(2);
  assert.equal(await page.evaluate(()=>gameDemo.progress.data.pvp.enabled),false);assert.match(await page.locator('.self-nameplate .pvp-status').textContent(),/☠ 60:00/);
  const result=await page.evaluate(()=>{gameDemo.saveSession();return {tailoring:gameDemo.progress.data.skills.tailoring,coins:gameDemo.progress.data.coins,bodyType:gameDemo.appearance.bodyType,trust:gameDemo.simulation.society.relationships.trust('player',2),guild:gameDemo.simulation.society.guildFor('player').name};});
  assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);
  await writeFile('test-results/expansion-play.json',JSON.stringify({result,monsters,errors,missing},null,2));console.log(JSON.stringify({result,monsters,errors,missing},null,2));
}finally{await browser.close();}
