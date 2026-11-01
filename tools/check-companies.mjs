import {chromium} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
const b=await chromium.launch({args:['--enable-gpu','--use-angle=d3d11']});const p=await b.newPage({viewport:{width:1440,height:900}});const errors=[];p.on('pageerror',e=>{errors.push(e.message);console.log(e.message);});p.on('console',m=>{if(m.type()==='error'){errors.push(m.text());console.log(m.text().slice(0,1500));}});
await p.goto('http://127.0.0.1:5173/battle.html');await p.waitForFunction(()=>window.battleDemo?.ready,{},{timeout:120000});console.log('Ready');
await p.waitForTimeout(2500);console.log(await p.evaluate(()=>({stats:battleDemo.simulation.stats(),graphics:battleDemo.crowd.stats(),calls:battleDemo.renderer.info.render.calls})));
await p.screenshot({path:'test-results/factions/battle-companies-wide.png'});
await p.evaluate(()=>{const b=battleDemo;b.setPlaying(false);const a=b.simulation.actors[110];b.camera.position.set(a.x+3,2.5,a.z+5);b.controls.target.copy(a.position);b.controls.target.y=1;b.controls.update();b.inspect(a.id);b.frame(.016);});
await p.screenshot({path:'test-results/factions/battle-companies-close.png'});await writeFile('test-results/factions/companies-errors.json',JSON.stringify(errors));await b.close();
