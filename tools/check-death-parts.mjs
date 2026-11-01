import {chromium} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const browser=await chromium.launch({args:['--enable-gpu','--use-angle=d3d11']});
try{
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto('http://127.0.0.1:5173/battle.html');await page.waitForFunction(()=>window.battleDemo?.ready,null,{timeout:120000});
  const result=await page.evaluate(()=>{
    const b=battleDemo;b.renderer.setAnimationLoop(null);b.setPlaying(false);b.camera.position.set(4,7,13);b.controls.target.set(0,0,0);b.controls.update();
    b.simulation.actors.forEach(a=>a.hidden=true);
    const parts=['head','armL','armR','legL','legR'];
    parts.forEach((part,i)=>{const a=b.simulation.actors[i];a.hidden=false;a.x=(i-2)*2;a.z=0;a.hp=0;a.deadAt=b.simulation.time;a.yaw=0;a.severedPart=part;a.lastImpact={zone:part,direction:{x:0,z:1}};a.hitDirection={x:0,z:1};});
    b.frame(0);
    for(let i=0;i<5;i++){b.crowd.update(b.camera,b.simulation.time,0);const a=b.simulation.actors[i];b.blood.hit(a,null,40,b.controls.target,b.crowd.posePoint(a));}
    for(let i=0;i<20;i++){b.simulation.time+=.025;b.crowd.update(b.camera,b.simulation.time,.025);b.blood.update(.025,b.controls.target);}b.frame(0);
    return {parts:[...b.crowd.fragments.records.values()].map(r=>r.part),particles:b.blood.particles.length,stats:b.crowd.stats()};
  });
  await page.screenshot({path:'test-results/factions/death-parts.png'});
  const freeze=await page.evaluate(()=>{const b=battleDemo;for(let i=0;i<100;i++){b.simulation.time+=.05;b.crowd.update(b.camera,b.simulation.time,.05);}const before=[...b.crowd.fragments.records.values()].map(r=>{r.group.updateMatrixWorld(true);return r.group.matrixWorld.toArray();});for(let i=0;i<20;i++){b.simulation.time+=.05;b.crowd.update(b.camera,b.simulation.time,.05);}b.frame(0);return {before,after:[...b.crowd.fragments.records.values()].map(r=>r.group.matrixWorld.toArray()),active:b.crowd.ragdolls.active};});
  assert.equal(result.parts.length,5);assert.equal(freeze.active,0);assert.deepEqual(freeze.before,freeze.after);assert.deepEqual(errors,[]);
  await page.screenshot({path:'test-results/factions/death-settled.png'});await writeFile('test-results/factions/death-parts.json',JSON.stringify({result,freeze,errors},null,2));console.log(result);
}finally{await browser.close();}
