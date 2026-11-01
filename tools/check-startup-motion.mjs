import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';

const browser=await chromium.launch({args:['--enable-gpu','--use-angle=d3d11','--disable-software-rasterizer']});
try{
  const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  let requests=0;
  await page.route('**/pine-leaves.png',route=>++requests===1?route.abort('failed'):route.continue());
  await page.goto('http://127.0.0.1:5173/');
  await page.waitForFunction(()=>window.gameDemo?.ready,null,{timeout:60000});
  assert.equal(requests,2,'A transient image failure is retried.');
  await page.evaluate(()=>gameDemo.renderer.setAnimationLoop(null));await page.click('#enter');
  const motion=await page.evaluate(()=>{
    const g=gameDemo,pop=g.population,guard=pop.residents.find(p=>p.type==='guard');
    const nav=pop.navigation,segment=nav.segmentClear,route=nav.route;
    const position=guard.position.clone(),phase=guard.actor.animator.phase;
    guard.actor.animator.motion=1;nav.segmentClear=()=>false;nav.route=()=>[];
    const now=Date.now();
    for(let i=0;i<90;i++)pop.update(1/30,guard.position,now+i*1000/30);
    const blocked={distance:position.distanceTo(guard.position),speed:guard.actualSpeed,phaseAdvance:guard.actor.animator.phase-phase,blend:guard.actor.animator.motion};
    nav.segmentClear=segment;nav.route=route;guard.pathGoal=null;
    let walking=0,maxError=0;
    for(let i=0;i<120;i++){
      const starts=pop.residents.map(p=>p.position.clone());pop.update(1/30,g.player.position,now+3000+i*1000/30);
      pop.residents.forEach((p,j)=>{if(p.target.hp<=0)return;const actual=Math.hypot(p.position.x-starts[j].x,p.position.z-starts[j].z)*30;const expected=actual<.04?0:Math.min(4,actual);maxError=Math.max(maxError,Math.abs(p.actualSpeed-expected));if(actual>.5)walking++;});
    }
    return {blocked,walking,maxError};
  });
  assert.ok(motion.blocked.distance<.001);assert.equal(motion.blocked.speed,0);assert.equal(motion.blocked.phaseAdvance,0);assert.ok(motion.blocked.blend<.001);assert.ok(motion.walking>30);assert.ok(motion.maxError<.00001);
  await page.evaluate(()=>{for(let i=0;i<30;i++)gameDemo.frame(1/60)});await page.screenshot({path:'test-results/startup-motion.png'});
  assert.deepEqual(errors,[]);
  await page.close();
  const broken=await browser.newPage();await broken.route('**/pine-leaves.png',route=>route.abort('failed'));
  await broken.goto('http://127.0.0.1:5173/game.html');
  await broken.getByRole('button',{name:'Try again',exact:true}).waitFor();
  assert.match(await broken.locator('#loading').textContent(),/Could not load texture: \/assets\/world\/pine-leaves.png/);
  const report={retryRequests:requests,motion,permanentFailure:'Visible asset URL and retry button',errors};
  await writeFile('test-results/startup-motion.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}
