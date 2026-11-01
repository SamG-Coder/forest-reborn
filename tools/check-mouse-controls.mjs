import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({args:['--enable-gpu','--use-angle=d3d11']});
try{
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[],checks=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:5173/game.html');await page.locator('#new-save').click();
  await page.waitForFunction(()=>window.gameDemo?.ready,null,{timeout:90000});
  await page.evaluate(()=>{const g=gameDemo;g.renderer.setAnimationLoop(null);g.voices.setMuted(true);g.state.mute=true;g.enter();g.opening.finish();g.player.position.set(70,g.world.height(70,70),70);g.player.yaw=Math.PI;g.state.cameraYaw=0;g.frame(.016);});
  const frame=async(n=1)=>page.evaluate(n=>{for(let i=0;i<n;i++)gameDemo.frame(1/60);},n);
  const snapshot=()=>page.evaluate(()=>({yaw:gameDemo.player.yaw,cameraYaw:gameDemo.state.cameraYaw,zoom:gameDemo.state.cameraDistance,position:gameDemo.player.position.toArray(),selections:gameDemo.input.selections.length,movement:gameDemo.input.movement,buttons:gameDemo.input.buttons.size}));
  const before=await snapshot();
  await page.mouse.move(620,420);await page.mouse.down({button:'left'});await page.mouse.move(800,440,{steps:9});await frame();
  const looked=await snapshot();assert.ok(Math.abs(looked.cameraYaw-before.cameraYaw)>.8);assert.equal(looked.yaw,before.yaw);
  await page.keyboard.down('w');await frame(30);await page.keyboard.up('w');
  const walked=await snapshot();assert.ok(walked.position[2]<before.position[2]-.4);assert.ok(Math.abs(walked.position[0]-before.position[0])<.05);
  await page.mouse.up({button:'left'});assert.equal((await snapshot()).selections,0);checks.push('Left drag orbits independently; W keeps character heading; drag never selects');
  await page.mouse.down({button:'right'});await page.mouse.move(630,410,{steps:8});await frame();
  const steered=await snapshot();assert.ok(Math.abs(Math.atan2(Math.sin(steered.yaw-steered.cameraYaw-Math.PI),Math.cos(steered.yaw-steered.cameraYaw-Math.PI)))<.0001);
  await page.keyboard.down('a');await frame(20);await page.keyboard.up('a');assert.equal((await snapshot()).yaw,steered.yaw);checks.push('Right drag aligns character; A/D strafe while steering');
  await page.mouse.down({button:'left'});const start=await snapshot();assert.equal(start.movement.z,1);await frame(40);const end=await snapshot();assert.ok(Math.hypot(end.position[0]-start.position[0],end.position[2]-start.position[2])>.6);
  await page.mouse.up({button:'left'});await page.mouse.up({button:'right'});assert.equal((await snapshot()).selections,0);checks.push('Both held buttons move forward and never leave a queued click');
  await page.mouse.click(660,470);assert.equal((await snapshot()).selections,1);await frame();checks.push('Single click remains available for target selection');
  const oldZoom=(await snapshot()).zoom;await page.mouse.wheel(0,300);await frame();assert.ok((await snapshot()).zoom>oldZoom);checks.push('Wheel zoom works');
  await page.mouse.down({button:'right'});await page.evaluate(()=>window.dispatchEvent(new Event('blur')));assert.equal((await snapshot()).buttons,0);await page.mouse.up({button:'right'});checks.push('Focus loss releases held movement');
  assert.deepEqual(errors,[]);await writeFile('test-results/mouse-controls.json',JSON.stringify({checks,errors},null,2));console.log({checks,errors});
}finally{await browser.close();}
