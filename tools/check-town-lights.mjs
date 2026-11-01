import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const label=process.argv[2]??'fixed',output='test-results/town-life';await mkdir(output,{recursive:true});
const browser=await chromium.launch({args:['--enable-gpu','--use-angle=d3d11']});
try{
  const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.stack));
  await page.goto('http://127.0.0.1:5173/');await page.locator('#new-save').click();await page.waitForFunction(()=>window.gameDemo?.ready,null,{timeout:120000});
  await page.evaluate(()=>{const g=gameDemo;g.voices.setMuted(true);g.enter();g.opening.finish();g.dev.teleport(850,-790);g.dev.time(12);});
  await page.waitForFunction(()=>gameDemo.expansion.zones.get('highmere'),null,{timeout:120000});await page.waitForTimeout(2500);
  await page.evaluate(()=>{window.lightProfile={samples:[],start:performance.now(),last:performance.now(),cost:{}};const g=gameDemo,s=lightProfile;s.programsBefore=g.renderer.info.programs.length;
    for(const [key,obj,method]of [['world',g.world,'update'],['forest',g.world.forest,'update'],['population',g.population,'update'],['render',g.renderer,'render'],['nav',g.population.navigation,'route'],['city',g.expansion.zones.get('highmere'),'update']]){const fn=obj[method].bind(obj);obj[method]=(...args)=>{const at=performance.now(),r=fn(...args);s.cost[key]=(s.cost[key]??0)+performance.now()-at;return r;};}
    const path=[[850,-750],[850,-789],[891,-789],[895,-830],[895,-877],[850,-877],[805,-876],[805,-830],[805,-788],[850,-750]];
    function sample(now){const t=Math.max(0,(now-s.start)/1000),u=Math.min(path.length-1.001,t/2.2),i=Math.floor(u),f=u-i;
      g.player.position.set(path[i][0]+(path[i+1][0]-path[i][0])*f,0,path[i][1]+(path[i+1][1]-path[i][1])*f);g.player.position.y=g.world.height(g.player.position.x,g.player.position.z);g.dayNight.clock.setHour(t>1?23:12);
      let lights=0;g.scene.traverseVisible(n=>{if(n.isPointLight)lights++;});s.samples.push({ms:Math.max(0,now-s.last),lights,programs:g.renderer.info.programs.length,cost:s.cost,x:g.player.position.x,z:g.player.position.z});s.cost={};s.last=now;s.raf=requestAnimationFrame(sample);
    }s.raf=requestAnimationFrame(sample);
  });
  await page.waitForTimeout(20500);
  const result=await page.evaluate(()=>{const s=lightProfile;cancelAnimationFrame(s.raf);const ms=s.samples.map(x=>x.ms).sort((a,b)=>a-b);return {samples:ms.length,mean:ms.reduce((a,b)=>a+b,0)/ms.length,p95:ms[Math.floor(ms.length*.95)],p99:ms[Math.floor(ms.length*.99)],max:ms.at(-1),over50:ms.filter(t=>t>50).length,lightCounts:[...new Set(s.samples.map(x=>x.lights))],programsBefore:s.programsBefore,programsAfter:gameDemo.renderer.info.programs.length,spikes:s.samples.filter(x=>x.ms>35||Object.values(x.cost).some(c=>c>15)),changes:s.samples.filter((x,i)=>!i||x.lights!==s.samples[i-1].lights||x.programs!==s.samples[i-1].programs)};});
  result.errors=errors;await writeFile(output+'/lights-'+label+'.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));assert.equal(errors.length,0);
  if(label==='fixed')assert.deepEqual(result.lightCounts,[8]);
}finally{await browser.close();}
