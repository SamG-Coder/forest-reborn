import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({args:['--enable-gpu','--use-angle=d3d11','--disable-software-rasterizer']});
try{
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:5173/game.html');await page.waitForFunction(()=>window.gameDemo?.ready,null,{timeout:60000});
  const report=await page.evaluate(()=>{
    const g=gameDemo;g.renderer.setAnimationLoop(null);const nav=g.population.navigation,bad=[];
    for(const person of g.population.residents.filter(p=>p.routine)){
      let previous=person.home;
      for(const stop of [...person.routine.stops,person.routine.stops[0]]){
        const goal={x:stop.x,z:stop.z},path=nav.route(previous,goal);
        if(!path.length&&Math.hypot(previous.x-goal.x,previous.z-goal.z)>1)bad.push({id:person.id,goal,reason:'no route'});
        let from=previous;
        for(const point of path){for(let t=.1;t<=1;t+=.1){const x=from.x+(point.x-from.x)*t,z=from.z+(point.z-from.z)*t;if(!nav.walkable(x,z,.24))bad.push({id:person.id,reason:'route intersects obstacle',x,z});}from=point;}
        previous=goal;
      }
    }
    const observer=g.player.position.clone().set(0,0,80);
    const baseline=Date.now();for(let i=0;i<6000;i++)g.population.update(.05,observer,baseline+i*50);
    const jobs=g.population.residents.filter(p=>p.routine).map(p=>({id:p.id,cycles:p.routine.cycles,stop:p.routine.index,position:p.position.toArray(),activity:p.activity,path:p.path?.slice(0,3),insideWall:!nav.walkable(p.position.x,p.position.z,.2)}));
    return {bad,jobs};
  });
  await writeFile('test-results/town-routes.json',JSON.stringify({...report,errors},null,2));console.log(JSON.stringify({...report,errors},null,2));
  assert.deepEqual(report.bad,[]);assert.ok(report.jobs.every(j=>j.cycles>0&&!j.insideWall));assert.deepEqual(errors,[]);
}finally{await browser.close();}
