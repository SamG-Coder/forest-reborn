import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({args:['--enable-gpu','--use-angle=d3d11','--disable-software-rasterizer']});
try{
  const page=await browser.newPage({viewport:{width:1440,height:960}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:5173/game.html');await page.waitForFunction(()=>window.gameDemo?.ready,null,{timeout:60000});
  const result=await page.evaluate(()=>{
    const g=gameDemo;g.renderer.setAnimationLoop(null);const sim=g.simulation,events=[],record=sim.record.bind(sim);
    sim.record=(actor,type,detail,now)=>{const person=g.population.residents.find(p=>p.data===actor);events.push({type,detail,actor:actor.id,position:person.position.toArray()});record(actor,type,detail,now);};
    const now=Date.now(),observer=g.player.position.clone().set(0,0,1000);
    for(let i=0;i<3600;i++)g.population.update(.5,observer,now+i*500,false);
    const counts={};for(const event of events)counts[event.type]=(counts[event.type]??0)+1;
    const stock={...sim.stock},nodes=g.world.resources.ledger.snapshot();
    const completedByActor=sim.actors.map(a=>({id:a.id,actions:events.filter(e=>e.actor===a.id).reduce((result,event)=>{result[event.type]=(result[event.type]??0)+1;return result;},{})}));
    const sellAway=events.filter(e=>e.type==='sell'&&Math.hypot(e.position[0]-10,e.position[2]-5)>2.1);
    sim.save(now+1800000);return {counts,stock,nodes,sellAway,completedByActor,actors:sim.actors.map(a=>({id:a.id,kills:a.kills,skill:a.skill,inventory:a.inventory,task:a.task,position:a.position})),playerXP:g.progress.data.xp};
  });
  console.log(JSON.stringify(result,null,2));
  assert.ok(result.counts.kill>0);assert.ok(result.counts.gather>0);assert.ok(result.counts.sell>0);assert.ok(result.counts.meal>0);assert.equal(result.counts.train??0,0);
  assert.deepEqual(result.sellAway,[]);assert.equal(result.playerXP,0);assert.ok(Object.values(result.stock).some(n=>n>0));
  assert.ok(result.completedByActor.every(a=>Object.values(a.actions).some(n=>n>0)),'Every adventurer completes real world actions in their chosen role');
  // A real reload integrates time against those same saved nodes and enemies.
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('forest-reborn-adventurers-v1')));
  // Move the whole simulated clock, including AI/event/respawn deadlines.
  const offset=Date.now()-600000-saved.updatedAt;
  function shiftTimes(value){for(const [key,entry]of Object.entries(value)){if(entry&&typeof entry==='object')shiftTimes(entry);else if(typeof entry==='number'&&entry>0&&(/At$|Until$/.test(key)||key==='time'))value[key]+=offset;}}
  shiftTimes(saved);
  const rejoined=await browser.newPage();rejoined.on('pageerror',e=>errors.push(e.message));
  await rejoined.addInitScript(saved=>localStorage.setItem('forest-reborn-adventurers-v1',JSON.stringify(saved)),saved);
  await rejoined.goto('http://127.0.0.1:5173/game.html');await rejoined.waitForFunction(()=>window.gameDemo?.ready,null,{timeout:60000});
  const offline=await rejoined.evaluate(()=>gameDemo.simulation.offline);assert.ok(offline.seconds>=600);assert.deepEqual(errors,[]);
  await writeFile('test-results/world-activity.json',JSON.stringify({result,offline,errors},null,2));console.log({offline,errors});
}finally{await browser.close();}
