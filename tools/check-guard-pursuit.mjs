import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';

const browser=await chromium.launch({args:['--enable-gpu','--use-angle=d3d11','--disable-software-rasterizer']});
try{
  const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:5173/game.html');await page.waitForFunction(()=>window.gameDemo?.ready,null,{timeout:60000});
  const natural=await page.evaluate(()=>{
    const g=gameDemo;g.renderer.setAnimationLoop(null);g.enter();const pop=g.population,now=Date.now();
    g.player.position.set(0,0,-35);let maxTurn=0,turningFrames=0;
    for(let i=0;i<2200;i++){
      const before=pop.residents.map(p=>p.actor.root.rotation.y);pop.update(.05,g.player.position,now+i*50);
      pop.residents.forEach((p,j)=>{const d=Math.abs(Math.atan2(Math.sin(p.actor.root.rotation.y-before[j]),Math.cos(p.actor.root.rotation.y-before[j])));maxTurn=Math.max(maxTurn,d);if(d>.001)turningFrames++;});
    }
    return {seconds:110,maxTurnDegrees:maxTurn*180/Math.PI,turningFrames,maxRouteReplans:Math.max(...pop.residents.map(p=>p.pathReplans??0)),cycles:pop.residents.filter(p=>p.type==='guard').map(p=>p.routine.cycles)};
  });
  assert.ok(natural.maxTurnDegrees<=10.314);assert.ok(natural.turningFrames>100);assert.ok(natural.maxRouteReplans<150);assert.ok(natural.cycles.every(n=>n>0));
  const pursuit=await page.evaluate(()=>{
    const g=gameDemo,pop=g.population;let now=Date.now();const guard=pop.residents.find(p=>p.id==='guard-0'),near=pop.residents.find(p=>p.id==='guard-2'),intruder=pop.residents.find(p=>p.type==='adventurer');
    pop.simulation.society.nextEventAt=now+999999;pop.simulation.society.event=null;
    for(const p of pop.residents){p.target.hp=0;p.respawnAt=now+999999;p.intent=null;p.threat=null;p.attack=null;p.routine=null;p.guardAnchor=null;p.returnPost=null;p.combatTarget=null;}
    for(const p of [guard,near,intruder]){p.target.hp=1000;p.path=[];p.pathGoal=null;p.pathFailedFor=0;}
    intruder.type='patron';intruder.data.task='rest';intruder.target.pvp.enabled=true;intruder.target.pvp.wantedUntil=now+999999;
    guard.position.set(-5,g.world.height(-5,-39),-39);near.position.set(2,g.world.height(2,30),30);intruder.position.set(0,g.world.height(0,30),30);
    pop.living.prepare(.05,now);const ignoresDistant=guard.intent===null&&near.intent?.type==='fight';
    intruder.position.set(-5,g.world.height(-5,-35),-35);pop.living.prepare(.05,now+=50);
    const acquired=guard.intent?.target===intruder.target;
    const anchor=guard.guardAnchor.clone();
    pop.living.behaviour(guard,.5,now);intruder.position.set(130,g.world.height(130,-120),-120);
    pop.living.prepare(.05,now+=50);
    const released=guard.intent?.type==='return'&&!guard.attack&&!guard.threat;
    for(let i=0;i<180;i++)pop.update(.05,g.player.position,now+=50);
    const returned=Math.hypot(guard.position.x-anchor.x,guard.position.z-anchor.z)<.8;
    // A skull without a current PvP flag or wanted timer is only a nameplate marker.
    intruder.position.set(-5,g.world.height(-5,-35),-35);Object.assign(intruder.target.pvp,{enabled:false,wantedUntil:0,skullUntil:now+3600000});
    pop.living.prepare(.05,now+=50);const ignoresSkull=guard.intent===null;
    return {ignoresDistant,acquired,released,returned,ignoresSkull};
  });
  assert.ok(Object.values(pursuit).every(Boolean),JSON.stringify(pursuit));assert.deepEqual(errors,[]);
  const report={natural,pursuit,errors};await writeFile('test-results/guard-pursuit.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}
