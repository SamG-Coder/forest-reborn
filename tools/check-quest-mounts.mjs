import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
await mkdir('test-results/quest-mounts',{recursive:true});
const browser=await chromium.launch({args:['--enable-gpu','--use-angle=d3d11','--disable-software-rasterizer']});
try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
  page.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});page.on('console',m=>{if(m.type()==='error'){errors.push(m.text());console.error(m.text());}});
  await page.goto('http://127.0.0.1:5173/game.html');await page.locator('#new-save').click();await page.waitForFunction(()=>window.gameDemo?.ready,null,{timeout:90000});
  await page.evaluate(()=>{const g=gameDemo;g.voices.setMuted(true);g.enter();g.opening.finish();g.renderer.setAnimationLoop(null);});
  assert.deepEqual(await page.evaluate(()=>gameDemo.progress.data.mounts),[]);
  await page.evaluate(async()=>{const g=gameDemo,{QUESTS}=await import('/src/progression/quests.js');for(const id of ['errand','supper','briar','cargo']){const q=QUESTS.find(q=>q.id===id);g.progress.accept(id);g.progress.recordObjective(q.kind,q.count);g.progress.claim(id);}});
  async function talk(id){await page.evaluate(id=>{const g=gameDemo,p=g.population.residents.find(p=>p.id===id);g.player.position.copy(p.position);g.player.position.z+=1.5;g.player.position.y=g.world.height(g.player.position.x,g.player.position.z);g.player.velocity.set(0,0,0);g.player.speed=0;g.worldUI.talk(p);g.frame(.05);},id);}
  await talk('captain');await page.locator('[data-quest="saddle-earned"] button').filter({hasText:'Take the job'}).click();
  await talk('stablemaster');await page.locator('[data-quest="saddle-earned"] button').filter({hasText:'Collect reward'}).click();
  assert.deepEqual(await page.evaluate(()=>gameDemo.progress.data.mounts),['bay']);
  await page.locator('[data-quest="north-road"] button').filter({hasText:'Take the job'}).click();
  await page.locator('.mount-shop summary').click();await page.mouse.move(4,700);await page.screenshot({path:'test-results/quest-mounts/stable-shop.png'});
  await page.evaluate(()=>{gameDemo.worldUI.quests('north-road');gameDemo.frame(.05);});await page.screenshot({path:'test-results/quest-mounts/journal.png'});
  await page.getByRole('button',{name:'Show destination on map',exact:true}).click();assert.equal(await page.locator('.world-map').getAttribute('data-center'),'838.000,-938.600');
  await page.evaluate(()=>{const g=gameDemo;g.worldUI.close();g.player.position.set(0,g.world.height(0,-55),-55);g.player.yaw=Math.PI;g.state.cameraYaw=0;g.state.cameraDistance=5.5;g.frame(.05);});
  await page.keyboard.press('h');assert.equal(await page.evaluate(()=>gameDemo.mounts.mounted),true);
  await page.keyboard.down('w');await page.evaluate(()=>{for(let i=0;i<30;i++)gameDemo.frame(.05);});await page.keyboard.up('w');
  const walk=await page.evaluate(()=>({speed:gameDemo.player.speed,z:gameDemo.player.position.z}));assert.ok(walk.speed>3&&walk.speed<3.3);
  await page.keyboard.down('Shift');await page.keyboard.down('w');await page.evaluate(()=>{for(let i=0;i<20;i++)gameDemo.frame(.05);});await page.keyboard.up('w');await page.keyboard.up('Shift');
  const canter=await page.evaluate(()=>({speed:gameDemo.player.speed,z:gameDemo.player.position.z}));assert.ok(canter.speed>8&&canter.z<walk.z-6);
  await page.evaluate(()=>{const g=gameDemo;for(let i=0;i<25;i++)g.frame(.05);const p=g.player.position;g.state.cameraYaw=g.player.yaw+.9;g.state.cameraPitch=.15;g.state.cameraDistance=4.8;g.followCamera.reset();g.frame(.05);});
  await page.screenshot({path:'test-results/quest-mounts/riding.png'});
  const pose=await page.evaluate(()=>{const g=gameDemo,b=g.avatar.rig.bones;return {mountOffset:g.player.mountOffset,hip:b.hips.getWorldPosition(g.player.position.clone()).y-g.player.position.y,hand:b.handR.getWorldPosition(g.player.position.clone()).toArray(),finite:Object.values(b).every(b=>b.matrixWorld.elements.every(Number.isFinite))};});assert.ok(pose.finite&&pose.hip>1.5&&pose.hip<1.8);
  await page.keyboard.press('h');assert.equal(await page.evaluate(()=>gameDemo.mounts.mounted),false);
  const layout=[];
  await page.evaluate(()=>{gameDemo.simulation.society.event={id:'hunt',type:'hunt',title:'Briar grove bounty',kind:'kill',x:84,z:-83,progress:2,goal:10,endsAt:Date.now()+180000};for(let i=0;i<10;i++)gameDemo.frame(.05);});
  for(const [width,height]of [[1440,1000],[1100,800],[1000,760]]){
    await page.setViewportSize({width,height});await page.evaluate(async()=>{await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);for(let i=0;i<10;i++)gameDemo.frame(.05);});
    const rectangles=await page.evaluate(()=>Object.fromEntries(['.minimap-frame','.quest-tracker','.world-event-box'].map(selector=>{const n=document.querySelector(selector),r=n.getBoundingClientRect();return [selector,{top:r.top,bottom:r.bottom,left:r.left,width:r.width,height:r.height,display:getComputedStyle(n).display,hidden:n.hidden}];})));
    const q=rectangles['.quest-tracker'],e=rectangles['.world-event-box'],m=rectangles['.minimap-frame'];assert.ok(!e.hidden&&e.height,'test includes a live bounty');assert.ok(e.top>=q.bottom,'event is below quest tracker');if(m.display!=='none'){assert.ok(q.top>=m.bottom,'quest is below map');assert.ok(m.height<400,'map legends retain their compact size');}layout.push({width,height,rectangles});
  }
  await page.setViewportSize({width:1440,height:1000});
  await page.evaluate(async()=>{await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);gameDemo.frame(.05);});
  await page.screenshot({path:'test-results/quest-mounts/quest-and-bounty.png'});
  await page.evaluate(()=>{const g=gameDemo;g.expansion.travel('highmere');});
  // Caravan travel is a test shortcut; walking and mounting use real keyboard input above.
  await page.evaluate(()=>{const g=gameDemo;g.player.position.set(850,g.world.height(850,-768),-768);g.expansion.update(.05,g.player.position);});
  await page.waitForFunction(()=>gameDemo.expansion.zones.get('highmere'),null,{timeout:90000});
  await talk('highmere-lord');await page.locator('[data-quest="north-road"] button').filter({hasText:'Collect reward'}).click();
  await page.locator('[data-quest="unlisted-arrival"] button').filter({hasText:'Take the job'}).click();await page.screenshot({path:'test-results/quest-mounts/lord-audience.png'});
  await talk('highmere-scribe');await page.locator('[data-quest="unlisted-arrival"] button').filter({hasText:'Collect reward'}).click();
  const result=await page.evaluate(()=>({quests:gameDemo.progress.data.quests,mounts:gameDemo.progress.data.mounts,activeMount:gameDemo.progress.data.activeMount}));
  assert.ok(result.quests['north-road'].completed&&result.quests['unlisted-arrival'].completed);assert.deepEqual(errors,[]);
  await writeFile('test-results/quest-mounts/runtime.json',JSON.stringify({walk,canter,pose,layout,result,errors},null,2));console.log(JSON.stringify({walk,canter,pose,result,errors},null,2));
}finally{await browser.close();}
