import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
await mkdir('test-results/quest-mounts',{recursive:true});
const browser=await chromium.launch({args:['--enable-gpu','--use-angle=d3d11']});
try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:5173/game.html');await page.locator('#new-save').click();await page.waitForFunction(()=>window.gameDemo?.ready,null,{timeout:90000});
  const route=await page.evaluate(async()=>{
    const g=gameDemo,{HIGHMERE_ROADS}=await import('/src/world/region-layout.js');
    g.voices.setMuted(true);g.enter();g.opening.finish();g.renderer.setAnimationLoop(null);g.progress.data.mounts=['bay'];g.progress.data.activeMount='bay';
    g.player.position.set(0,g.world.height(0,-55),-55);g.player.speed=0;g.player.velocity.set(0,0,0);g.player.yaw=Math.PI;
    g._render=g.renderer.render.bind(g.renderer);g.renderer.render=()=>{};
    return [...HIGHMERE_ROADS[7].points,...HIGHMERE_ROADS[0].points.slice(1),...HIGHMERE_ROADS[1].points.slice(1)];
  });
  await page.keyboard.press('h');assert.equal(await page.evaluate(()=>gameDemo.mounts.mounted),true);
  await page.keyboard.down('w');await page.keyboard.down('Shift');const segments=[];
  for(const point of route){
    const segment=await page.evaluate(([x,z])=>{
      const g=gameDemo,start=g.mounts.distance;let steps=0,still=0;
      while(Math.hypot(g.player.position.x-x,g.player.position.z-z)>.7&&steps<1800){
        g.player.yaw=Math.atan2(x-g.player.position.x,z-g.player.position.z);g.state.cameraYaw=g.player.yaw+Math.PI;
        const old=g.player.position.clone();g.frame(.05);steps++;if(old.distanceTo(g.player.position)<.001)still++;else still=0;if(still>12)break;
      }
      return {point:[x,z],position:g.player.position.toArray(),steps,travel:g.mounts.distance-start,error:Math.hypot(g.player.position.x-x,g.player.position.z-z),mounted:g.mounts.mounted};
    },point);
    segments.push(segment);console.log(JSON.stringify(segment));assert.ok(segment.error<.8,'road blocked at '+JSON.stringify(segment));assert.ok(segment.mounted);
    if(Math.hypot(point[0]-850,point[1]+850)<290)await page.waitForFunction(()=>gameDemo.expansion.zones.get('highmere'),null,{timeout:90000});
  }
  await page.keyboard.up('w');await page.keyboard.up('Shift');
  await page.evaluate(()=>{const g=gameDemo;g.renderer.render=g._render;for(let i=0;i<24;i++)g.frame(.05);g.state.cameraDistance=7;g.state.cameraYaw=.9;g.state.cameraPitch=.18;g.followCamera.reset();g.frame(.05);});
  await page.screenshot({path:'test-results/quest-mounts/horse-at-keep.png'});
  const travelled=segments.reduce((sum,s)=>sum+s.travel,0);assert.ok(travelled>1200);
  await page.keyboard.press('h');assert.equal(await page.evaluate(()=>gameDemo.mounts.mounted),false);
  await page.evaluate(()=>{gameDemo.player.yaw=Math.PI;});await page.keyboard.down('w');await page.evaluate(()=>{for(let i=0;i<100;i++)gameDemo.frame(.05);});await page.keyboard.up('w');
  const entered=await page.evaluate(()=>gameDemo.player.position.toArray());assert.ok(entered[2]<-920,'dismounted rider enters hall');
  assert.deepEqual(errors,[]);await writeFile('test-results/quest-mounts/road.json',JSON.stringify({travelled,segments,entered,errors},null,2));console.log('Full mounted route passed: '+travelled.toFixed(1)+' metres.');
}finally{await browser.close();}
