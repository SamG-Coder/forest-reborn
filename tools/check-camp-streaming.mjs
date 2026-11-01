import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const output='test-results/camp-streaming';await mkdir(output,{recursive:true});
const base=process.argv[2]??'http://127.0.0.1:5173/';
const browser=await chromium.launch({args:['--enable-gpu','--use-angle=d3d11']});
try{
  const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[];
  page.on('pageerror',e=>{errors.push(e.stack);console.log(e.stack);});
  await page.goto(base);await page.locator('#new-save').click();
  await page.waitForFunction(()=>window.gameDemo?.ready,null,{timeout:120000});
  await page.evaluate(()=>{const g=gameDemo;g.voices.setMuted(true);g.enter();g.opening.finish();g.dev.teleport(-96,-160);g.dev.time(12);for(const c of Object.values(g.townLife.director.save.camps))c.nextAt=1e9;g.combat.receive=()=>0;});
  const before=await page.evaluate(()=>{const g=gameDemo,group=g.townLife.groups.get('cart-camp');g.townLife.director.start('cart-camp',{strength:group.filter(t=>t.hp>0).length});return {ids:group.map(t=>t.id),positions:group.map(t=>t.position.toArray()),count:g.population.targets.length};});
  await page.waitForTimeout(24000);
  const after=await page.evaluate(()=>{const g=gameDemo;return {ids:g.townLife.groups.get('cart-camp').map(t=>t.id),positions:g.townLife.groups.get('cart-camp').map(t=>t.position.toArray()),encounters:g.townLife.encounters(),count:g.population.targets.length,nav:g.population.navigation.stats()};});
  assert.deepEqual(after.ids,before.ids);assert.equal(after.count,before.count);
  assert.ok(after.positions.some((p,i)=>Math.hypot(p[0]-before.positions[i][0],p[2]-before.positions[i][2])>8),'camp inhabitants actually march');
  await page.screenshot({path:output+'/forest-raid.png'});
  await page.evaluate(()=>gameDemo.dev.teleport(1270,-1310));await page.waitForTimeout(1500);
  const locked=await page.evaluate(()=>({zones:gameDemo.expansion.zones.stats(),armies:gameDemo.population.targets.filter(t=>t.externalSimulation).length}));
  assert.equal(locked.armies,0);assert.equal(locked.zones.find(z=>z.id==='northern-battle').status,'dormant');
  await page.evaluate(()=>{const g=gameDemo;g.progress.data.worldFlags.beaconLit=true;g.progress.data.quests['road-beacon']={completed:true};g.progress.accept('northern-stand');g.expansion.director.update(0);g.expansion.joinCampaign('ash');window.loadTasks=[];window.taskObserver=new PerformanceObserver(list=>loadTasks.push(...list.getEntries().map(e=>e.duration)));taskObserver.observe({type:'longtask',buffered:false});});
  await page.waitForFunction(()=>gameDemo.expansion.zones.get('northern-battle'),null,{timeout:240000});
  const staged=await page.evaluate(()=>{taskObserver.disconnect();const g=gameDemo,field=g.expansion.zones.get('northern-battle');return {count:field.enemies.length,stage:g.expansion.director.save.campaign.stage,side:g.expansion.director.save.campaign.chosenSide,time:field.simulation.time,locked:field.enemies.every(t=>t.battleLocked),tasks:loadTasks,forest:g.world.forest.stats()};});
  assert.equal(staged.count,10000);assert.equal(staged.stage,'muster');assert.equal(staged.time,0);assert.equal(staged.side,'ash');assert.ok(staged.locked);
  const clearSlots=await page.evaluate(()=>{const s=gameDemo.expansion.zones.get('northern-battle').simulation;return s.actors.filter(a=>!s.walkable(a.x,a.z)).length;});
  assert.equal(clearSlots,0,'staged soldiers are outside trunks and tents');
  await page.screenshot({path:output+'/ash-muster.png'});
  assert.ok(await page.evaluate(()=>gameDemo.expansion.beginCampaign()));
  await page.evaluate(()=>gameDemo.expansion.cinematic.finish());await page.waitForTimeout(1500);
  await page.evaluate(()=>gameDemo.expansion.cinematic.finish());await page.waitForTimeout(2000);
  const battle=await page.evaluate(()=>{const g=gameDemo,s=g.expansion.zones.get('northern-battle');return {time:s.simulation.time,playerTeam:s.simulation.guests.get('player').team,hostile:s.enemies.filter(t=>t.hostile).every(t=>t.team===0),stage:g.expansion.director.save.campaign.stage,stats:s.stats()};});
  assert.ok(battle.time>0);assert.equal(battle.playerTeam,1);assert.ok(battle.hostile);
  // Accelerated simulation-only coverage of the real terrain/obstacle layout;
  // this verifies contact, not a full-world performance rate.
  const contact=await page.evaluate(async()=>{
    const g=gameDemo;g.renderer.setAnimationLoop(null);const s=g.expansion.zones.get('northern-battle').simulation;
    for(let i=0;i<2400&&s.hits<20;i++){s.step(()=>{});if(i%8===0)await new Promise(r=>setTimeout(r,0));}
    return {seconds:s.time,hits:s.hits,lateCampMembers:g.townLife.groups.get('ash-road-camp').length,giants:g.townLife.groups.get('ash-shield-camp').filter(t=>t.kind==='hillGiant').length};
  });
  assert.ok(contact.hits>=20,'opposing companies reach combat through the forest');assert.equal(contact.lateCampMembers,6);assert.equal(contact.giants,1);
  await page.evaluate(()=>gameDemo.saveSession());
  const saved=await page.evaluate(()=>Boolean(gameDemo.expansion.director.state('northern-battle').packed));assert.ok(saved);
  const result={base,before,after,locked,staged,clearSlots,battle,contact,saved,errors};await writeFile(output+'/result.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));assert.equal(errors.length,0);
}finally{await browser.close();}
