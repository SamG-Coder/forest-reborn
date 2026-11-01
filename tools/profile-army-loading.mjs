import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
await mkdir('test-results/camp-streaming',{recursive:true});
const browser=await chromium.launch({args:['--enable-gpu','--use-angle=d3d11']});
try{
  const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.stack));
  await page.goto('http://127.0.0.1:5173/');await page.locator('#new-save').click();await page.waitForFunction(()=>window.gameDemo?.ready,null,{timeout:120000});
  await page.evaluate(()=>{const g=gameDemo;g.voices.setMuted(true);g.enter();g.opening.finish();g.dev.time(12);window.loadProfile=[];
    for(const key of ['render','compile','compileAsync','initTexture']){const fn=g.renderer[key].bind(g.renderer);g.renderer[key]=(...args)=>{const start=performance.now(),v=fn(...args),ms=performance.now()-start;if(ms>20)loadProfile.push({key,start,ms});return v;};}
    window.longLoadTasks=[];window.taskObserver=new PerformanceObserver(list=>longLoadTasks.push(...list.getEntries().map(e=>({start:e.startTime,ms:e.duration}))));taskObserver.observe({type:'longtask',buffered:false});
    g.progress.data.worldFlags.beaconLit=true;g.progress.data.quests['road-beacon']={completed:true};g.progress.accept('northern-stand');g.expansion.director.update(0);g.expansion.joinCampaign('ash');
  });
  await page.waitForFunction(()=>gameDemo.expansion.zones.get('northern-battle'),null,{timeout:240000});await page.waitForTimeout(2000);
  const result=await page.evaluate(()=>{taskObserver.disconnect();return {renderer:loadProfile,tasks:longLoadTasks,programs:gameDemo.renderer.info.programs.length,nav:gameDemo.population.navigation.stats()};});result.errors=errors;console.log(JSON.stringify(result,null,2));await writeFile('test-results/camp-streaming/load-profile.json',JSON.stringify(result,null,2));
}finally{await browser.close();}
