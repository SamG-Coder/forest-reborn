import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';

await mkdir('test-results/creatures',{recursive:true});
const browser=await chromium.launch({args:['--enable-gpu','--use-angle=d3d11','--disable-software-rasterizer']});
try{
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:5173/creatures.html');
  await page.waitForFunction(()=>window.creaturePreview?.ready,null,{timeout:90000});
  await page.evaluate(()=>{const p=creaturePreview;p.renderer.setAnimationLoop(null);p.frame(.016);});
  await page.screenshot({path:'test-results/creatures/rabbits.png'});
  await page.locator('#goblins').click();await page.evaluate(()=>creaturePreview.frame(.016));
  await page.screenshot({path:'test-results/creatures/goblins.png'});
  const poses=[];
  for(const motion of ['walk','run','attack']){
    await page.locator('#motion').selectOption(motion);
    const metrics=await page.evaluate(()=>{const p=creaturePreview;for(let i=0;i<60;i++)p.frame(1/60);let invalid=0;p.scene.traverse(o=>{if(o.isMesh){o.updateWorldMatrix(true,false);if(o.matrixWorld.elements.some(n=>!Number.isFinite(n)))invalid++;}});return {invalid,triangles:p.renderer.info.render.triangles};});
    assert.equal(metrics.invalid,0);poses.push({motion,...metrics});
    await page.screenshot({path:`test-results/creatures/goblin-${motion}.png`});
  }
  await page.locator('#motion').selectOption('idle');await page.locator('#clothing').uncheck();await page.evaluate(()=>creaturePreview.frame(.016));
  await page.screenshot({path:'test-results/creatures/goblin-base.png'});
  await page.locator('#clothing').check();await page.evaluate(()=>creaturePreview.frame(.016));
  await page.evaluate(()=>{const p=creaturePreview;for(let i=0;i<90;i++)p.frame(1/60);p.controls.target.set(0,1.12,0);p.camera.position.set(0,1.27,1.35);p.controls.update();p.frame(.016);});
  await page.screenshot({path:'test-results/creatures/goblin-ears-front.png'});
  await page.evaluate(()=>{const p=creaturePreview;p.camera.position.set(.85,1.27,1.15);p.controls.update();p.frame(.016);});
  await page.screenshot({path:'test-results/creatures/goblin-ears-quarter.png'});
  assert.deepEqual(errors,[]);
  await writeFile('test-results/creatures/preview.json',JSON.stringify({poses,errors},null,2));console.log('Creature previews and three animation poses rendered successfully.');
}finally{await browser.close();}
