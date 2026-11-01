import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';

const browser=await chromium.launch({args:['--enable-gpu','--use-angle=d3d11','--disable-software-rasterizer']});
try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:5173/game.html');await page.waitForFunction(()=>window.gameDemo?.ready,null,{timeout:60000});
  const report=await page.evaluate(()=>{
    const g=gameDemo;g.renderer.setAnimationLoop(null);g.enter();const pop=g.population;let now=Date.now();
    pop.simulation.society.nextEventAt=now+999999;pop.simulation.society.event=null;
    for(const p of pop.residents){p.target.hp=0;p.respawnAt=now+999999;p.intent=null;p.threat=null;p.attack=null;p.routine=null;p.guardAnchor=null;p.returnPost=null;p.combatTarget=null;}
    const guard=pop.residents.find(p=>p.id==='guard-0'),visitor=pop.residents.find(p=>p.type==='adventurer');
    for(const p of [guard,visitor]){p.target.hp=1000;p.path=[];p.pathGoal=null;p.pathFailedFor=0;}
    guard.position.set(0,g.world.height(0,39),39);guard.home.copy(guard.position);
    visitor.position.set(0,g.world.height(0,41),41);Object.assign(visitor.target.pvp,{enabled:true,wantedUntil:0,combatUntil:0,clearAt:0,clearRequested:false});
    // A hostile hovering either side of the town line must remain one encounter.
    visitor.data.personality.greed=1;visitor.data.personality.courage=1;
    pop.living.prepare(.05,now);now+=11000;pop.living.prepare(.05,now);let fights=0,returns=0;
    for(let i=0;i<100;i++){
      visitor.position.z=i%2?41.9:42.1;pop.living.prepare(.05,now+=50);
      if(guard.intent?.type==='fight')fights++;if(guard.intent?.type==='return')returns++;
    }
    visitor.position.z=55;pop.living.prepare(.05,now+=50);const disengaged=guard.intent?.type==='return';
    guard.position.copy(guard.returnPost);let edgeReacquires=0;
    for(let i=0;i<300;i++){visitor.position.z=i%2?41.9:42.1;pop.living.prepare(.05,now+=50);if(guard.intent?.type==='fight')edgeReacquires++;}
    // A compliant adventurer with a town errand leaves, waits for the real
    // countdown, then resumes work. Count all physical boundary crossings.
    guard.target.hp=0;guard.respawnAt=now+999999;visitor.data.personality.greed=.2;visitor.data.personality.courage=.4;
    visitor.townExit=null;visitor.threat=null;visitor.data.inventory={wood:5};visitor.data.task='sell';visitor.data.nextDecisionAt=now+999999;
    visitor.position.set(0,g.world.height(0,41),41);Object.assign(visitor.target.pvp,{enabled:true,wantedUntil:0,combatUntil:0,clearAt:0,clearRequested:false});
    const watch=pop.residents.find(p=>p.id==='guard-1');watch.target.hp=1000;watch.position.set(4,g.world.height(4,38),38);
    pop.living.prepare(.05,now);watch.target.hp=0;watch.respawnAt=now+999999;
    let outside=false,crossings=0,unsafeReentries=0,waitFrames=0,clearAt=null,minWaitZ=Infinity,maxWaitZ=-Infinity;
    for(let i=0;i<1200;i++){
      pop.update(.05,g.player.position,now+=50);const current=visitor.position.z>=42;
      if(current!==outside){crossings++;if(!current&&visitor.target.pvp.enabled)unsafeReentries++;outside=current;}
      if(visitor.townExit&&current){waitFrames++;minWaitZ=Math.min(minWaitZ,visitor.position.z);maxWaitZ=Math.max(maxWaitZ,visitor.position.z);}
      if(!visitor.target.pvp.enabled&&clearAt===null)clearAt=now;
    }
    return {fights,returns,disengaged,edgeReacquires,crossings,unsafeReentries,waitFrames,minWaitZ,maxWaitZ,flagCleared:clearAt!==null,resumedJob:!visitor.townExit,finalPosition:visitor.position.toArray()};
  });
  assert.equal(report.fights,100);assert.equal(report.returns,0);assert.equal(report.disengaged,true);assert.equal(report.edgeReacquires,0);
  assert.equal(report.unsafeReentries,0);assert.ok(report.waitFrames>500);assert.equal(report.flagCleared,true);assert.equal(report.resumedJob,true);assert.ok(report.crossings<=2);
  assert.deepEqual(errors,[]);await writeFile('test-results/guard-boundary.json',JSON.stringify({report,errors},null,2));console.log(report);
}finally{await browser.close();}
