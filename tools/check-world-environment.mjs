import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const output='test-results/world-environment';await mkdir(output,{recursive:true});
const browser=await chromium.launch({args:['--enable-gpu','--use-angle=d3d11']});
try{
  const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[];
  page.on('pageerror',e=>{errors.push(e.stack);console.log(e.stack);});
  page.on('console',m=>{if(m.type()==='error'){errors.push(m.text());console.log(m.text());}});
  await page.goto('http://127.0.0.1:5173/');await page.locator('#new-save').click();
  await page.waitForFunction(()=>window.gameDemo?.ready,null,{timeout:120000});
  await page.evaluate(()=>{const g=gameDemo;g.voices.setMuted(true);g.enter();g.opening.finish();g.dev.teleport(850,-798);g.dev.time(10);});
  await page.waitForFunction(()=>gameDemo.expansion.zones.get('highmere'),null,{timeout:120000});
  await page.evaluate(()=>{gameDemo.renderer.setAnimationLoop(null);for(const c of Object.values(gameDemo.townLife.director.save.camps))c.nextAt=1e9;});
  async function photo(name,point,camera,look,hour){
    await page.evaluate(async({point,camera,look,hour})=>{const g=gameDemo;g.dev.teleport(...point);g.dev.time(hour);
      for(let i=0;i<2000;i++){g.world.update(i/60,g.player.position,1/60);await new Promise(r=>setTimeout(r,8));if(i>50&&!g.world.forest.stats().queuedChunks)break;}
      camera[1]=Math.max(camera[1],g.world.height(camera[0],camera[2])+2.5);
      g.camera.position.set(...camera);g.camera.lookAt(...look);g.camera.updateMatrixWorld();g.dayNight.update(0,g.player.position);
      g.scene.updateMatrixWorld(true);g.renderer.render(g.scene,g.camera);document.querySelector('#hud').style.visibility='hidden';
    },{point,camera,look,hour});
    await page.screenshot({path:output+'/'+name+'.png'});
  }
  const h=await page.evaluate(()=>gameDemo.world.height(850,-810));
  await photo('highmere-square',[850,-798],[855,h+6,-790],[842,h+5,-860],10);
  const door=await page.evaluate(()=>gameDemo.world.height(816,-780));
  await photo('caravan-door',[816,-791],[816,door+1.7,-795],[816,door+2,-786],11);
  await photo('night-sky',[850,-780],[850,h+5,-770],[810,h+32,-900],23);
  await photo('river',[-244,-220],[-205,17,-180],[-275,2,-250],11);
  await photo('lake',[-320,750],[-290,11,850],[-550,-7,680],16);
  await photo('mountains',[-1000,-750],[-910,75,-680],[-1280,150,-830],10);
  const stats=await page.evaluate(()=>({landscape:gameDemo.world.landscape.stats(),lights:gameDemo.dayNight.stats(),render:gameDemo.renderer.info.render,geometries:gameDemo.renderer.info.memory.geometries}));
  await writeFile(output+'/result.json',JSON.stringify({errors,stats},null,2));assert.equal(errors.length,0);console.log(JSON.stringify(stats));
}finally{await browser.close();}
