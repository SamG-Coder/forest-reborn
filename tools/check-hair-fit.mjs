import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({args:['--enable-gpu','--use-angle=d3d11','--disable-software-rasterizer']});
try{
  const page=await browser.newPage({viewport:{width:1200,height:900}}),errors=[],results=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto('http://127.0.0.1:5173/gear.html');await page.waitForFunction(()=>window.gearLab?.ready);
  await page.evaluate(()=>gearLab.renderer.setAnimationLoop(null));
  for(const style of ['short','swept','shaggy'])for(const hat of ['','head.cloth-cap','head.iron-open']){
    const result=await page.evaluate(({style,hat})=>{
      const g=gearLab;g.equipment.apply(hat?[hat]:[]);g.avatar.hair.setStyle(style);g.avatar.hair.setHeadwear(hat?g.equipment.entries.get('head').definition:null);
      g.setMode('idle');for(let i=0;i<60;i++)g.advance(1/60);
      g.camera.position.set(.45,1.76,.9);g.camera.lookAt(0,1.69,0);g.renderer.render(g.scene,g.camera);
      return {style,hat,capVisible:g.avatar.hair.meshes.find(m=>m.userData.isCap).visible,covered:g.avatar.hair.covered,finite:g.avatar.hair.meshes.every(m=>Array.from(m.geometry.attributes.position.array).every(Number.isFinite))};
    },{style,hat});results.push(result);
    assert.equal(result.capVisible,!hat);assert.equal(result.covered,Boolean(hat));assert.ok(result.finite);
    await page.screenshot({path:`test-results/hair-${style}-${hat||'bare'}.png`});
  }
  assert.deepEqual(errors,[]);await writeFile('test-results/hair-fit.json',JSON.stringify({results,errors},null,2));console.log({fits:results.length,errors});
}finally{await browser.close();}
