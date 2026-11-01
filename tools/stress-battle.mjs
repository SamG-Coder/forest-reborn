import {chromium} from '@playwright/test';
import {BattleSimulation} from '../src/world/battle-simulation.js';
import {writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {recordHitImpact} from '../src/game/hit-impact.js';
const summary=values=>{const a=values.slice().sort((a,b)=>a-b);return {mean:a.reduce((s,n)=>s+n,0)/a.length,p95:a[Math.floor(a.length*.95)],max:a.at(-1)};};
const simulation=new BattleSimulation(10000),timings=[];let damageEvents=0;
for(let step=0;step<1200;step++){const start=performance.now();simulation.update(.05,(target,damage,attacker,kind)=>{assert.ok(target.hp>=0);assert.notEqual(target.team,attacker.team);if(kind==='strike')assert.ok(Math.hypot(target.x-attacker.x,target.z-attacker.z)<=attacker.reach+.001);recordHitImpact(target,attacker,damage);damageEvents++;});timings.push(performance.now()-start);simulation.events.length=0;}
assert.equal(simulation.actors.length,10000);assert.equal(new Set(simulation.actors.map(a=>`${a.homeX},${a.homeZ}`)).size,10000);assert.ok(damageEvents>0);
const result={simulation:simulation.stats(),simulationStepMs:summary(timings),damageEvents};console.log(JSON.stringify(result));
const browser=await chromium.launch({args:['--enable-gpu','--use-angle=d3d11']});
try{
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto('http://127.0.0.1:5173/battle.html?army=5000');await page.waitForFunction(()=>window.battleDemo?.ready,null,{timeout:120000});
  const measure=async name=>{
    const data=await page.evaluate(async()=>{
      const b=battleDemo;b.renderer.setAnimationLoop(null);const frames=[],cpu=[];let last=performance.now(),cards=0,numbers=0;const hits=b.simulation.hits;
      for(let i=0;i<240;i++)await new Promise(resolve=>requestAnimationFrame(()=>{
        const now=performance.now(),dt=Math.min(.1,(now-last)/1000);if(i>60)frames.push(now-last);last=now;
        b.frame(dt);if(i>60)cpu.push(performance.now()-now);
        cards=Math.max(cards,document.querySelectorAll('.battle-cluster-card:not([hidden])').length);numbers=Math.max(numbers,document.querySelectorAll('.combat-text:not([hidden])').length);resolve();
      }));
      const summary=a=>{a.sort((x,y)=>x-y);return {mean:a.reduce((s,n)=>s+n,0)/a.length,p95:a[Math.floor(a.length*.95)],max:a.at(-1)};};
      const gl=b.renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');
      return {frameMs:summary(frames),cpuFrameMs:summary(cpu),draws:b.renderer.info.render.calls,triangles:b.renderer.info.render.triangles,graphics:b.crowd.stats(),damageEvents:b.simulation.hits-hits,maxCards:cards,maxNumbers:numbers,gpu:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):'unknown'};
    });
    await page.screenshot({path:`test-results/factions/battle-10000-${name}.png`});assert.ok(data.maxCards<=4);console.log(name,JSON.stringify(data));return data;
  };
  result.rendering={opening:await measure('opening')};
  await page.evaluate(snapshot=>{const b=battleDemo;b.simulation.restore(snapshot);b.frame(0);const focus=b.simulation.actors.find(a=>a.hp>0&&a.strike)??b.simulation.actors.find(a=>a.hp>0);const p=focus.position.clone().project(b.camera);b.overlays.pointer={x:(p.x*.5+.5)*innerWidth,y:(-p.y*.5+.5)*innerHeight};},simulation.snapshot());
  result.rendering.combatWide=await measure('combat-wide');
  await page.evaluate(()=>{const b=battleDemo;const focus=b.simulation.actors.filter(a=>a.hp>0&&a.strike).sort((a,c)=>Math.abs(a.z)-Math.abs(c.z))[0]??b.simulation.actors.find(a=>a.hp>0);b.camera.position.copy(focus.position).add({x:8,y:5,z:11});b.controls.target.copy(focus.position);b.controls.target.y+=1;b.controls.update();b.inspect(focus.id);b.frame(0);const p=focus.position.clone().project(b.camera);b.overlays.pointer={x:(p.x*.5+.5)*innerWidth,y:(-p.y*.5+.5)*innerHeight};});
  result.rendering.combatClose=await measure('combat-close');assert.ok(result.rendering.combatClose.graphics.lodCounts[0]>0);assert.ok(result.rendering.combatWide.damageEvents>0);assert.deepEqual(errors,[]);result.errors=errors;

}finally{await browser.close();}
await writeFile('test-results/factions/stress-10000.json',JSON.stringify(result,null,2));
