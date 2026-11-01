import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';

await mkdir('test-results',{recursive:true});
const browser=await chromium.launch({args:['--enable-gpu','--use-angle=d3d11','--disable-software-rasterizer']});
try{
  const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[],missing=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.status()>=400)missing.push(`${r.status()} ${r.url()}`);});
  await page.goto('http://127.0.0.1:5173/game.html?revision=world-review-15');
  await page.waitForFunction(()=>window.gameDemo?.ready,null,{timeout:60000});
  await page.evaluate(()=>gameDemo.renderer.setAnimationLoop(null));await page.click('#enter');
  const frame=async(n=1)=>page.evaluate(n=>{for(let i=0;i<n;i++)gameDemo.frame(1/60);},n);
  async function beside(id){
    await page.evaluate(id=>{const g=gameDemo,p=g.population.residents.find(p=>p.id===id);g.player.position.copy(p.position);g.player.position.z+=2.2;g.player.position.y=g.world.height(g.player.position.x,g.player.position.z);g.player.velocity.set(0,0,0);g.selectEnemy(null);g.followCamera.reset();},id);
    await frame(30);
  }
  await frame(120);await page.mouse.move(10,500);await page.screenshot({path:'test-results/world-review-town.png'});
  const art=await page.evaluate(()=>{
    const g=gameDemo,world=g.world,materials=[];world.town.root.traverse(o=>{if(o.isMesh&&o.material.map)materials.push(o.material.map.image.src);});
    return {walls:materials.filter(p=>/wall-brick|wall-timber|roof-clay/.test(p)),herbs:world.resources.roots.get('herbs-1').children.map(o=>o.material.map?.image.src),bark:world.materials.bark.map.image.src,ferns:world.forest.textures['fern-v2'].image.src};
  });
  for(const name of ['wall-brick','wall-timber','roof-clay'])assert.ok(art.walls.some(p=>p.includes(name)),name+' used in town');
  assert.equal(art.herbs.length,3);assert.ok(art.herbs.every(p=>p.includes('herb-v2')));
  await beside('innkeeper');
  const marker=page.locator('[data-person="innkeeper"] .quest-nameplate-marker');
  assert.equal(await marker.textContent(),'!');
  assert.match(await page.locator('.minimap-frame canvas').getAttribute('aria-label'),/Tomas: new quest available/);
  await page.keyboard.press('KeyM');await frame();
  assert.match(await page.locator('.world-map').getAttribute('aria-label'),/Tomas: new quest available/);
  await page.mouse.move(5,500);await page.screenshot({path:'test-results/quest-map-new.png'});await page.click('.panel-close');
  await page.keyboard.press('KeyV');await page.getByRole('button',{name:'Take the job',exact:true}).click();await frame(30);
  assert.equal(await marker.textContent(),'');await page.click('.panel-close');
  await beside('trader');await page.keyboard.press('KeyV');await page.getByRole('button',{name:'Pick up Tomas’s flour',exact:true}).click();await page.click('.panel-close');
  await beside('innkeeper');assert.equal(await marker.textContent(),'?');
  assert.match(await page.locator('.minimap-frame canvas').getAttribute('aria-label'),/Tomas: quest ready to turn in/);
  await page.keyboard.press('KeyM');await frame(30);assert.match(await page.locator('.world-map').getAttribute('aria-label'),/Tomas: quest ready to turn in/);
  await page.mouse.move(5,500);await page.screenshot({path:'test-results/quest-map-hand-in.png'});await page.click('.panel-close');
  await page.keyboard.press('KeyV');await page.getByRole('button',{name:'Collect reward',exact:true}).click();await page.click('.panel-close');await frame(30);assert.equal(await marker.textContent(),'!');
  await page.keyboard.press('KeyB');
  assert.ok(await page.locator('.inventory-slot .item-art').count()>0);
  assert.match(await page.locator('.inventory-slot .item-art').first().evaluate(e=>getComputedStyle(e).backgroundImage),/items-v2.png/);
  await page.locator('.inventory-slot .item-art').first().evaluate(async e=>{const image=new Image();image.src=getComputedStyle(e).backgroundImage.slice(5,-2);await image.decode();});
  await page.screenshot({path:'test-results/generated-item-bag.png'});await page.click('.close-player-panel');
  await page.click('#camera-options');assert.ok(await page.locator('[name="steady"]').isChecked());assert.equal(await page.locator('[name="shake"]').isEnabled(),false);
  await page.locator('#camera-fov').evaluate(e=>{e.value=72;e.dispatchEvent(new Event('input',{bubbles:true}));});await frame();assert.equal(await page.evaluate(()=>gameDemo.camera.fov),72);
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('forest-reborn-camera-v1')).fov),72);
  await page.locator('[name="steady"]').uncheck();assert.ok(await page.locator('[name="shake"]').isEnabled());
  await page.locator('.camera-reset').click();await frame();assert.equal(await page.evaluate(()=>gameDemo.camera.fov),60);
  await page.mouse.move(5,500);await page.screenshot({path:'test-results/camera-settings.png'});await page.keyboard.press('KeyB');assert.ok(await page.locator('.camera-settings').isHidden());assert.ok(await page.locator('.player-panel').isVisible());await page.keyboard.press('KeyM');assert.ok(await page.locator('.player-panel').isHidden());await page.click('.panel-close');
  // Exercise actual movement and rendering on the GPU, keeping yaw fixed.
  const motion=await page.evaluate(async()=>{
    const g=gameDemo;g.selectEnemy(null);g.player.position.set(0,g.world.height(0,72),72);g.player.velocity.set(0,0,0);g.followCamera.reset();g.state.cameraYaw=0;g.state.cameraDistance=4.5;g.state.cameraPitch=.32;g.frame(1/60);
    const reference=g.camera.quaternion.clone(),samples=[],positions=[];let previous=performance.now(),i=0,maxAngle=0,minFov=100,maxFov=0;
    g.input.keys.add('KeyS');
    await new Promise(resolve=>g.renderer.setAnimationLoop(now=>{
      const rawDt=Math.max(0,(now-previous)/1000),dt=Math.min(.05,rawDt);previous=now;
      if(i===120)g.input.keys.add('ShiftLeft');
      g.frame(dt);if(i>30)samples.push(rawDt*1000);positions.push(g.player.position.toArray());
      maxAngle=Math.max(maxAngle,g.camera.quaternion.angleTo(reference));minFov=Math.min(minFov,g.camera.fov);maxFov=Math.max(maxFov,g.camera.fov);
      if(++i>=360){g.renderer.setAnimationLoop(null);g.input.clear();resolve();}
    }));
    const sorted=[...samples].sort((a,b)=>a-b),gl=g.renderer.getContext(),debug=gl.getExtension('WEBGL_debug_renderer_info');
    return {fps:1000/(samples.reduce((a,b)=>a+b,0)/samples.length),p95ms:sorted[Math.floor(sorted.length*.95)],maxViewAngleChangeDegrees:maxAngle*180/Math.PI,fov:[minFov,maxFov],distance:Math.hypot(positions.at(-1)[0]-positions[0][0],positions.at(-1)[2]-positions[0][2]),drawCalls:g.renderer.info.render.calls,triangles:g.renderer.info.render.triangles,gpu:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):'unknown'};
  });
  assert.ok(motion.distance>8);assert.ok(motion.maxViewAngleChangeDegrees<.001);assert.deepEqual(motion.fov,[60,60]);
  await page.evaluate(()=>{const g=gameDemo,n=g.world.resources.ledger.nodes[0];g.player.position.set(n.x,g.world.height(n.x,n.z+1.6),n.z+1.6);g.followCamera.reset();g.state.cameraDistance=3.4;g.state.cameraPitch=.65;g.state.cameraYaw=.9;});await frame(45);
  await page.screenshot({path:'test-results/generated-herbs.png'});
  assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);
  const report={quests:'Both maps and nameplate followed ! → hidden → ? → ! through real quest dialogue.',generatedArt:art,motion,errors,missing};
  await writeFile('test-results/world-review.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}
