import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
await mkdir('test-results/world-updates',{recursive:true});
const browser=await chromium.launch({args:['--enable-gpu','--use-angle=d3d11','--disable-software-rasterizer']});
try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
  page.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});
  await page.goto('http://127.0.0.1:5173/game.html');await page.locator('#new-save').click();
  await page.waitForFunction(()=>window.gameDemo?.ready,null,{timeout:90000});
  await page.evaluate(()=>{const g=gameDemo;g.renderer.setAnimationLoop(null);g.voices.setMuted(true);g.enter();g.opening.finish();for(let i=0;i<5;i++)g.frame(.05);});
  const cameraBefore=await page.evaluate(()=>({yaw:gameDemo.state.cameraYaw,pitch:gameDemo.state.cameraPitch,zoom:gameDemo.state.cameraDistance,lock:gameDemo.state.lock?.id}));
  const maps=[];
  async function exercise(locator,name){
    const oldRange=Number(await locator.getAttribute('data-range')),box=await locator.boundingBox();
    assert.ok(box);
    const cx=box.x+box.width/2,cy=box.y+box.height/2;
    await page.mouse.move(cx,cy);await page.mouse.wheel(0,-350);
    const zoomIn=Number(await locator.getAttribute('data-range'));assert.ok(zoomIn<oldRange);
    const centered=await locator.getAttribute('data-center');
    await page.mouse.down();await page.mouse.move(cx+55,cy+35,{steps:8});await page.mouse.up();
    const panned=await locator.getAttribute('data-center');assert.notEqual(panned,centered);
    await page.evaluate(()=>{for(let i=0;i<8;i++)gameDemo.frame(.05);});
    assert.equal(await locator.getAttribute('data-center'),panned,'automatic redraw must preserve panning');
    const capture=await locator.screenshot({path:`test-results/world-updates/${name}-panned.png`});assert.ok(capture.length>5000);
    const frame=locator.locator('..');await frame.getByRole('button',{name:'Centre on me'}).click();
    assert.equal(await frame.getAttribute('data-following'),'true');
    assert.equal(await locator.getAttribute('data-center'),await page.evaluate(()=>`${gameDemo.player.position.x.toFixed(3)},${gameDemo.player.position.z.toFixed(3)}`));
    maps.push({name,oldRange,zoomIn,centered,panned});
  }
  await exercise(page.locator('canvas.minimap'),'minimap');
  await page.keyboard.press('KeyM');await exercise(page.locator('canvas.world-map'),'world-map');
  // All map input must remain isolated from movement, targeting and camera input.
  const cameraAfter=await page.evaluate(()=>({yaw:gameDemo.state.cameraYaw,pitch:gameDemo.state.cameraPitch,zoom:gameDemo.state.cameraDistance,lock:gameDemo.state.lock?.id}));
  assert.deepEqual(cameraAfter,cameraBefore);assert.equal(await page.evaluate(()=>gameDemo.input.selections.length),0);
  await page.screenshot({path:'test-results/world-updates/world-map.png'});
  await page.locator('#world-ui .world-panel .panel-close').click();
  const wildlife=await page.evaluate(()=>{
    const g=gameDemo,animals=g.population.targets.filter(t=>t.wildlife),before=animals.map(t=>({id:t.id,x:t.position.x,z:t.position.z}));
    // Observe wildlife in live population updates without simulated hunters killing the sample.
    const old=g.population.residents.map(p=>p.cinematic);g.population.residents.forEach(p=>p.cinematic=true);
    for(let i=0;i<180;i++)g.population.update(.1,g.player.position,Date.now()+i*100,true);
    const moves=animals.map((t,i)=>({id:t.id,habitat:t.habitat.id,distance:Math.hypot(t.position.x-before[i].x,t.position.z-before[i].z)}));
    g.population.residents.forEach((p,i)=>p.cinematic=old[i]);
    const t=animals[0],dead=[t.position.x,t.position.z];t.hp=0;t.readyAt=0;g.population.update(.01,g.player.position,Date.now(),true);
    return {moves,habitats:[...new Set(animals.map(t=>t.habitat.id))],respawned:t.hp===t.maxHp,respawnDistance:Math.hypot(t.position.x-dead[0],t.position.z-dead[1])};
  });
  assert.equal(wildlife.habitats.length,4);assert.ok(wildlife.moves.filter(a=>a.distance>1).length>=10);assert.ok(wildlife.respawned);assert.ok(wildlife.respawnDistance>.5);
  // Trigger the real town-law warning, then wait for actual TTS playback completion.
  await page.evaluate(()=>{
    const g=gameDemo,guard=g.population.residents.find(p=>p.id==='guard-0');
    g.population.residents.forEach(p=>{if(p!==guard)p.cinematic=true;});
    g.population.living.speechEvents.length=0;g.population.living.law.warnings.clear();g.population.living.law.recentWarnings.clear();
    g.player.position.set(0,g.world.height(0,0),0);guard.position.set(0,g.world.height(0,-3),-3);guard.desiredYaw=0;
    g.progress.data.pvp.enabled=true;g.progress.data.pvp.clearRequested=false;g.voices.setMuted(false);g.frame(.05);
  });
  const speech=page.locator('[data-person="guard-0"] .speech-bubble');await page.waitForFunction(()=>gameDemo.voices.busy('guard'),null,{timeout:30000});
  await page.waitForFunction(()=>gameDemo.voices.channels.get('guard')?.playing,null,{timeout:30000});
  await page.evaluate(()=>{gameDemo.worldUI.update(1000);});
  assert.match(await speech.textContent(),/no fighting in town/);assert.ok(await speech.isVisible());
  await page.screenshot({path:'test-results/world-updates/guard-speech.png'});
  await page.waitForFunction(()=>gameDemo.voices.playbackEvents.some(e=>e.channel==='guard'&&!e.cancelled),null,{timeout:30000});
  const voice=await page.evaluate(()=>gameDemo.voices.playbackEvents.filter(e=>e.channel==='guard'));
  assert.deepEqual(errors,[]);await writeFile('test-results/world-updates/runtime.json',JSON.stringify({maps,wildlife,voice,errors},null,2));console.log('Passed map input isolation, terrain rendering, four roaming habitats, respawn and voiced overhead guard warning.');
}finally{await browser.close();}
