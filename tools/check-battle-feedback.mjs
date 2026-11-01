import {chromium} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const browser=await chromium.launch({args:['--enable-gpu','--use-angle=d3d11']});
try{
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto('http://127.0.0.1:5173/battle.html');await page.waitForFunction(()=>window.battleDemo?.ready,null,{timeout:120000});
  const result=await page.evaluate(()=>{
    const b=battleDemo;b.renderer.setAnimationLoop(null);b.setPlaying(false);
    b.camera.position.set(18,28,45);b.controls.target.set(0,0,0);b.controls.update();
    for(let i=0;i<600;i++)b.simulation.update(.05);
    b.frame(0);const focus=b.simulation.actors.find(a=>a.hp>0&&a.strike);b.inspect(focus.id);b.camera.position.copy(focus.position).add({x:18,y:28,z:45});b.controls.target.copy(focus.position);b.controls.update();b.frame(0);const p=focus.position.clone().project(b.camera);b.overlays.pointer={x:(p.x*.5+.5)*innerWidth,y:(-p.y*.5+.5)*innerHeight};
    b.setPlaying(true);for(let i=0;i<60;i++)b.frame(.05);b.setPlaying(false);b.damage.update(.4,innerWidth,innerHeight);b.frame(0);
    const text=[...document.querySelectorAll('.combat-text')].filter(e=>!e.hidden).map(e=>({text:e.textContent,position:getComputedStyle(e).position,x:parseFloat(e.style.left),y:parseFloat(e.style.top),opacity:parseFloat(e.style.opacity)}));
    const tiles=[...b.blood.tiles.values()].map(t=>({at:t.at,vertices:t.mesh.geometry.attributes.position.count}));
    return {stats:b.simulation.stats(),text,tiles};
  });
  assert.ok(result.text.length>0);assert.ok(result.text.every(t=>t.position==='absolute'&&t.x>0&&t.y>0&&t.opacity>0));
  await page.screenshot({path:'test-results/factions/battle-feedback.png'});
  const fade=await page.evaluate(()=>{const b=battleDemo;b.damage.update(1.4,innerWidth,innerHeight);return b.damage.active.length;});assert.equal(fade,0);
  await page.evaluate(()=>{const b=battleDemo;b.blood.reset();b.blood.stain(0,0,.65,{x:1,z:0});b.camera.position.set(4,6,7);b.controls.target.set(0,0,0);b.controls.update();b.crowd.root.visible=false;b.frame(0);});
  await page.screenshot({path:'test-results/factions/blood-boundary.png'});
  assert.deepEqual(errors,[]);await writeFile('test-results/factions/battle-feedback.json',JSON.stringify({result,errors},null,2));
  console.log(JSON.stringify({stats:result.stats,numbers:result.text.length,tiles:result.tiles.length,errors}));
}finally{await browser.close();}
