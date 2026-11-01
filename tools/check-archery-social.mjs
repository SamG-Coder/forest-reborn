import {chromium} from '@playwright/test';
import {writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
await mkdir('test-results/factions',{recursive:true});
const browser=await chromium.launch({args:['--enable-gpu','--use-angle=d3d11']});
try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto('http://127.0.0.1:5173/');await page.locator('#new-save').click();await page.waitForFunction(()=>window.gameDemo?.ready,null,{timeout:120000});
  await page.evaluate(()=>{const g=gameDemo;g.renderer.setAnimationLoop(null);g.voices.setMuted(true);g.enter();g.opening.finish();g.player.position.set(0,g.world.height(0,60),60);g.player.yaw=0;g.progress.data.level=15;g.progress.addItem('weapon.shortbow');g.progress.addItem('arrow.iron',12);g.weapon('weapon.shortbow');g.frame(.016);});
  const begin=await page.evaluate(()=>{
    const g=gameDemo;g.combat.reset();g.combat.random=()=>1;
    const target=g.world.targets.find(a=>a.kind==='goblin');target.hp=target.maxHp=500;target.dormant=true;target.position.copy(g.player.position);target.position.z+=14;target.position.y=g.world.height(target.position.x,target.position.z);g.selectEnemy(target);
    return {started:g.requestAttack('sword'),weapon:g.combat.weapon,arrows:g.progress.data.bag.filter(s=>s?.id==='arrow.iron').reduce((n,s)=>n+s.count,0)};
  });assert.ok(begin.started);assert.equal(begin.arrows,12);
  await page.evaluate(()=>{const g=gameDemo;for(let i=0;i<34;i++)g.frame(.025);const V=g.player.position.constructor;g.camera.position.copy(g.player.position).add(new V(2.3,1.8,2.7));g.camera.lookAt(g.player.position.clone().add(new V(0,1.3,.2)));g.renderer.render(g.scene,g.camera);});
  await page.screenshot({path:'test-results/factions/archer-draw.png'});
  const shot=await page.evaluate(()=>{const g=gameDemo;for(let i=0;i<70;i++)g.frame(.025);return {hp:g.combat.target.hp,arrows:g.progress.data.bag.filter(s=>s?.id==='arrow.iron').reduce((n,s)=>n+s.count,0),skill:g.progress.data.skills.archery};});
  assert.ok(shot.hp<500);assert.equal(shot.arrows,11);
  await page.evaluate(()=>{const g=gameDemo;g.selectEnemy(null);const p=g.population.residents.find(p=>p.id==='innkeeper');g.player.position.copy(p.position);g.player.position.x+=1;g.worldUI.talk(p);});
  await page.getByRole('button',{name:'Ask for directions',exact:true}).click();
  await page.getByRole('searchbox',{name:'Find a local place'}).fill('bowstring');
  await page.locator('article').filter({hasText:'Loom & sewing table'}).getByRole('button',{name:'Ask & mark map',exact:true}).click();
  const pin=await page.evaluate(()=>gameDemo.progress.data.mapPin);assert.match(pin.name,/Loom/);
  await page.screenshot({path:'test-results/factions/directions.png'});
  await page.getByRole('button',{name:'Open map',exact:true}).click();await page.screenshot({path:'test-results/factions/directions-map.png'});
  await page.evaluate(()=>{
    const g=gameDemo;g.worldUI.close();const p=g.population.residents.find(p=>p.type==='adventurer');
    p.data.journey.phase='quests';p.target.pvp.enabled=false;p.threat=null;p.position.set(2,g.world.height(2,4),4);g.player.position.copy(p.position);g.player.position.x+=1;
    g.simulation.factions.economy.markets.mosswake.stock.herbs=0;g.simulation.factions.economy.markets.mosswake.stock.flax=0;g.worldUI.talk(p);
  });
  await page.getByRole('button',{name:'Work together',exact:true}).click();
  await page.getByRole('button',{name:'Propose supply agreement',exact:true}).click();
  assert.equal(await page.locator('[data-contract]').count(),1);await page.screenshot({path:'test-results/factions/shared-order.png'});
  const contract=await page.evaluate(()=>gameDemo.population.contracts.agreements[0]);assert.equal(contract.kind,'supply');
  const agency=await page.evaluate(()=>{
    const g=gameDemo,c=g.population.contracts.agreements[0],j=g.simulation.questAgents.get(c.partner),p=j.person;
    g.worldUI.close();p.talkingUntil=0;p.intent=null;p.threat=null;
    // Resolve only this actor, using its real pathing and world resources.
    // No inventory is injected: the partner must gather and deliver its half.
    const start=Date.now();for(let i=0;i<4000&&!c.contributions.partner.delivered;i++)g.population.update(.1,g.player.position,start+i*100,false);
    return {delivered:c.contributions.partner.delivered,status:c.status,activity:p.activity,position:p.position.toArray(),bag:j.progress.data.bag};
  });console.log({begin,shot,pin,contract,agency,errors});assert.ok(agency.delivered,'Partner failed to complete its physical supply task');assert.equal(agency.status,'active');
  assert.deepEqual(errors,[]);await writeFile('test-results/factions/archery-social.json',JSON.stringify({begin,shot,pin,contract,agency,errors},null,2));
}finally{await browser.close();}
