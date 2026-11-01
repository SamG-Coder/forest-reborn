import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
await mkdir('test-results/city',{recursive:true});
const browser=await chromium.launch({args:['--enable-gpu','--use-angle=d3d11','--disable-software-rasterizer']});
try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
  page.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});page.on('console',m=>{if(m.type()==='error'){errors.push(m.text());console.error(m.text().slice(0,500));}});
  await page.goto('http://127.0.0.1:5173/game.html');await page.locator('#new-save').click();await page.waitForFunction(()=>window.gameDemo?.ready,null,{timeout:90000});
  await page.evaluate(()=>{const g=gameDemo;g.voices.setMuted(true);g.enter();g.opening.finish();g.expansion.travel('highmere');});
  await page.waitForFunction(()=>gameDemo.expansion.zones.get('highmere'),null,{timeout:90000});
  const workPoints=await page.evaluate(()=>{const g=gameDemo;return g.population.residents.filter(p=>p.household).flatMap(p=>p.stops.map(s=>({name:p.name,x:s.x,z:s.z,walkable:g.population.navigation.walkable(s.x,s.z)})));});
  assert.ok(workPoints.every(p=>p.walkable),JSON.stringify(workPoints.filter(p=>!p.walkable)));
  await page.evaluate(()=>{const g=gameDemo;g.player.position.set(851,g.world.height(851,-806),-806);g.state.cameraYaw=0;g.state.cameraPitch=.2;g.followCamera.reset();});
  await page.waitForFunction(()=>gameDemo.expansion.zones.get('highmere').characterLOD.stats().fullCharacters>=8,null,{timeout:90000});
  await page.waitForTimeout(1800);
  await page.mouse.move(3,700);await page.screenshot({path:'test-results/city/citizens.png'});
  const detail=await page.evaluate(()=>gameDemo.expansion.zones.get('highmere').characterLOD.stats());
  const performance=await page.evaluate(()=>new Promise(resolve=>{const samples=[];let last=performance.now(),end=last+5000;function tick(now){samples.push(now-last);last=now;if(now<end)requestAnimationFrame(tick);else{samples.sort((a,b)=>a-b);resolve({mean:samples.reduce((a,b)=>a+b,0)/samples.length,p95:samples[Math.floor(samples.length*.95)],frames:samples.length,drawCalls:gameDemo.renderer.info.render.calls,triangles:gameDemo.renderer.info.render.triangles});}}requestAnimationFrame(tick);}));
  await page.evaluate(()=>gameDemo.renderer.setAnimationLoop(null));
  const routes=await page.evaluate(async()=>{
    const {HIGHMERE_ROADS}=await import('/src/world/region-layout.js'),g=gameDemo;
    const blocks=[];
    for(let road=0;road<HIGHMERE_ROADS.length;road++){const r=HIGHMERE_ROADS[road];for(let i=1;i<r.points.length;i++){const a=r.points[i-1],b=r.points[i];if(!g.population.navigation.segmentClear({x:a[0],z:a[1]},{x:b[0],z:b[1]}))blocks.push({road,a,b});}}
    return {blocks,gate:g.population.navigation.segmentClear({x:850,z:-722},{x:850,z:-755}),hall:g.population.navigation.segmentClear({x:838,z:-914},{x:838,z:-934})};
  });console.log('routes',routes);assert.deepEqual(routes.blocks,[]);assert.ok(routes.gate);assert.ok(routes.hall);
  // Walk through the portal using the real input and collision path.
  await page.evaluate(()=>{const g=gameDemo;g.player.position.set(838,g.world.height(838,-914),-914);g.player.yaw=Math.PI;g.player.velocity.set(0,0,0);g.state.cameraYaw=Math.PI;});
  await page.keyboard.down('w');await page.evaluate(()=>{for(let i=0;i<180;i++)gameDemo.frame(.05);});await page.keyboard.up('w');
  const entrance=await page.evaluate(()=>({position:gameDemo.player.position.toArray()}));assert.ok(entrance.position[2]<-921,'player can enter the hall through its doorway');
  const capture=async(name,x,z,camera,target)=>{await page.evaluate(({x,z,camera,target})=>{const g=gameDemo;g.player.position.set(x,g.world.height(x,z),z);for(let i=0;i<6;i++)g.frame(.05);g.camera.position.set(...camera);g.camera.lookAt(...target);g.camera.updateMatrixWorld();g.expansion.zones.get('highmere').trees.update(g.camera);g.worldUI.update(0);g.renderer.render(g.scene,g.camera);},{x,z,camera,target});await page.screenshot({path:`test-results/city/${name}.png`});};
  const h=await page.evaluate(()=>gameDemo.world.height(850,-831));
  await capture('fountain',851,-821,[856,h+3,-822],[850,h+1,-831]);
  const k=await page.evaluate(()=>gameDemo.world.height(838,-930));
  await capture('keep',838,-910,[867,k+1.9,-893],[834,k+8,-930]);
  await capture('hall',838,-925,[838,k+2.3,-919],[837,k+1.4,-936]);
  const oakHeight=await page.evaluate(()=>gameDemo.world.height(800,-829));
  await capture('old-oak',800,-813,[800,oakHeight+3,-808],[800,oakHeight+7,-829]);
  const servants=await page.evaluate(()=>{const g=gameDemo;g.player.position.set(838,g.world.height(838,-928),-928);const people=g.population.residents.filter(p=>p.household),before=people.map(p=>({travel:p.jobTravel??0,work:p.jobWork??0}));for(let i=0;i<2400;i++)g.frame(.05);return people.map((p,i)=>({name:p.name,travel:p.jobTravel-before[i].travel,work:p.jobWork-before[i].work,cycles:p.taskRoutine.cycles,activity:p.activity,failed:p.pathFailedFor??0}));});
  console.log('household',servants);
  for(const person of servants){assert.ok(person.travel>3,person.name+' travels between work points');assert.ok(person.work>5,person.name+' stops to work');assert.ok(person.failed<1,person.name+' is not blocked');}
  await page.evaluate(()=>{const g=gameDemo;g.player.position.set(968,g.world.height(968,-742),-742);g.frame(.05);});
  const far=await page.evaluate(()=>gameDemo.expansion.zones.get('highmere').characterLOD.stats());assert.ok(far.fullCharacters<detail.fullCharacters);
  assert.deepEqual(errors,[]);await writeFile('test-results/city/runtime.json',JSON.stringify({detail,far,performance,routes,entrance,servants,errors},null,2));console.log(JSON.stringify({detail,far,performance,routes,entrance,servants},null,2));
}finally{await browser.close();}
