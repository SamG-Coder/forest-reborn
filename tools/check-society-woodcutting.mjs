import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {writeFile,mkdir} from 'node:fs/promises';
await mkdir('test-results',{recursive:true});
const browser=await chromium.launch({args:['--enable-gpu','--use-angle=d3d11','--disable-software-rasterizer']});
try{
  const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[];
  page.on('pageerror',e=>{errors.push(e.message);console.log('Page error:',e.message);});
  await page.goto('http://127.0.0.1:5173/game.html?revision=living-world-16');await page.waitForFunction(()=>window.gameDemo?.ready,null,{timeout:60000});
  await page.evaluate(()=>{gameDemo.renderer.setAnimationLoop(null);window.testNow=Date.now();Date.now=()=>window.testNow;});await page.click('#enter');
  const frame=async(n=1,dt=1/60)=>page.evaluate(({n,dt})=>{for(let i=0;i<n;i++){testNow+=dt*1000;gameDemo.frame(dt);}},{n,dt});
  await page.evaluate(()=>{const r=gameDemo.simulation.society.relationships;r.improve('player',0,30);for(const ids of [[1,3,5],[2,4,6]])for(let i=1;i<ids.length;i++)r.improve(ids[0],ids[i],20);});
  await frame();await page.keyboard.press('KeyG');await page.getByLabel('Guild name',{exact:true}).fill('Road Lanterns');await page.getByRole('button',{name:'Form guild',exact:true}).click();
  await page.locator('[data-tab="companions"]').click();await page.getByRole('button',{name:'Invite Ewan Reed',exact:true}).click();
  assert.deepEqual(await page.evaluate(()=>gameDemo.simulation.society.guildFor('player').members),['player',0]);await page.getByRole('button',{name:'Close guilds and events'}).click();
  console.log('Player guild and NPC invitation verified');
  const tree=await page.evaluate(()=>{
    const g=gameDemo;
    const trees=g.world.resources.available().filter(n=>n.tree);
    for(const tree of trees.filter(n=>n.x>75&&n.x<120&&n.z>5&&n.z<45&&!trees.some(other=>other!==n&&Math.hypot(other.x-n.x,other.z-n.z)<6))){
      const x=tree.x,z=tree.z+1.1;if(g.population.navigation.walkable(x,z,.35)){g.player.position.set(x,g.world.height(x,z),z);g.player.velocity.set(0,0,0);g.followCamera.reset();return {id:tree.id,x,z};}
    }
  });assert.ok(tree);
  await frame(2);await page.keyboard.press('KeyV');await frame();assert.equal(await page.evaluate(()=>gameDemo.skillAction.current),null);assert.match(await page.locator('#message').innerText(),/axe/);
  await page.evaluate(()=>{const g=gameDemo,p=g.population.residents.find(p=>p.id==='trader');g.player.position.set(p.position.x,p.position.y,p.position.z+2);g.player.velocity.set(0,0,0);g.progress.data.coins=15;});await frame(2);await page.keyboard.press('KeyV');await page.click('[data-tab="buy"]');await page.getByRole('button',{name:'Buy Woodcutting axe',exact:true}).click();await page.click('.panel-close');
  assert.equal(await page.evaluate(()=>gameDemo.progress.data.coins),0);assert.ok(await page.evaluate(()=>gameDemo.progress.hasItem('axe')));
  await page.evaluate(tree=>{const g=gameDemo;g.player.position.set(tree.x,g.world.height(tree.x,tree.z),tree.z);g.player.velocity.set(0,0,0);g.state.cameraYaw=1.1;g.state.cameraPitch=.25;g.state.cameraDistance=3.4;g.followCamera.reset();},tree);
  await frame(2);await page.keyboard.press('KeyV');await frame(60);tree.id=await page.evaluate(()=>gameDemo.skillAction.current?.node.id);
  assert.equal(await page.evaluate(()=>gameDemo.skillAction.current?.definition.animation),'chop');assert.ok(await page.evaluate(()=>gameDemo.avatar.root.getObjectByName('job-chop').visible));
  await page.mouse.move(5,500);await page.screenshot({path:'test-results/chopping-tree.png'});await frame(250);
  assert.equal(await page.evaluate(()=>gameDemo.progress.data.inventory.wood),3);assert.equal(await page.evaluate(id=>gameDemo.world.forest.treeHarvest.trees.get(id).remaining,tree.id),0);
  await frame(180);
  const fell=await page.evaluate(id=>{const g=gameDemo,scales=[];g.scene.traverse(o=>{const index=o.userData.treeIds?.indexOf(id);if(index>=0){const matrix=o.matrix.clone();o.getMatrixAt(index,matrix);scales.push(Math.hypot(matrix.elements[0],matrix.elements[1],matrix.elements[2]));}});return {scales,collision:g.world.colliders.some(c=>c.id===id),saved:g.population.snapshot().trees.some(t=>t.id===id)};},tree.id);
  assert.ok(fell.scales.length===2&&fell.scales.every(s=>s===0));assert.equal(fell.collision,false);assert.ok(fell.saved);
  await page.screenshot({path:'test-results/tree-felled.png'});console.log('Bought axe, animated chopping, actual tree removed, wood and saved state verified');
  const factions=await page.evaluate(()=>{
    const g=gameDemo;g.player.position.set(0,g.world.height(0,60),60);g.player.velocity.set(0,0,0);
    for(let i=0;i<160;i++){testNow+=500;g.population.update(.5,g.player.position,testNow,false);}
    g.simulation.society.startEvent('roadClaim',testNow);const before=g.population.residents.filter(p=>p.data).map(p=>p.target.hp);let fights=0,fleeing=0,flags=0;
    for(let i=0;i<440;i++){
      testNow+=250;g.population.update(.25,g.player.position,testNow,false);
      fights+=g.population.residents.filter(p=>p.intent?.type==='fight').length;fleeing+=g.population.residents.filter(p=>p.intent?.type==='flee'||p.intent?.type==='leave').length;flags=Math.max(flags,g.simulation.actors.filter(a=>a.pvp.enabled).length);
    }
    return {guilds:g.simulation.society.guilds.map(g=>({name:g.name,ethos:g.ethos,members:g.members})),fights,fleeing,flags,before,after:g.population.residents.filter(p=>p.data).map(p=>p.target.hp),progress:g.simulation.society.event?.progress,notices:g.simulation.society.notices};
  });
  console.log('Faction event',{guilds:factions.guilds.length,fights:factions.fights,fleeing:factions.fleeing,flags:factions.flags,notices:factions.notices.length});assert.ok(factions.guilds.some(g=>g.ethos==='outlaw'));assert.ok(factions.fights>0);assert.ok(factions.flags>1);assert.ok(factions.fleeing>0);assert.ok(factions.after.some(h=>h<100));
  await frame();await page.keyboard.press('KeyG');await page.screenshot({path:'test-results/guilds-and-events.png'});await page.getByRole('button',{name:'Close guilds and events'}).click();
  // Isolate a single watchman for deterministic warning and retaliation checks.
  const guardId=await page.evaluate(()=>{
    const g=gameDemo;g.simulation.society.event=null;g.simulation.society.nextEventAt=testNow+999999;
    for(const p of g.population.residents){p.threat=null;p.attack=null;p.intent=null;Object.assign(p.target.pvp,{enabled:false,clearAt:0,combatUntil:0,wantedUntil:0});if(p.type==='guard'||p.id==='captain'){p.position.set(120,g.world.height(120,120),120);p.routine=null;}}
    const guard=g.population.residents.find(p=>p.type==='guard');guard.position.set(1,g.world.height(1,38),38);guard.target.hp=guard.maxHp;
    g.player.position.set(0,g.world.height(0,38),38);g.player.velocity.set(0,0,0);g.combat.hp=100;g.selectEnemy(null);g.state.cameraYaw=0;g.followCamera.reset();return guard.id;
  });
  await frame();await page.click('#pvp-toggle');await frame(85,.1);
  assert.ok(await page.locator('.law-warning').isVisible());assert.equal(await page.evaluate(()=>gameDemo.combat.hp),100);await page.screenshot({path:'test-results/guard-warning.png'});
  await frame(25,.1);assert.ok(await page.evaluate(()=>gameDemo.combat.hp)<100);assert.equal(await page.evaluate(id=>gameDemo.population.residents.find(p=>p.id===id).target.pvp.enabled,guardId),false);
  const guardPoint=await page.evaluate(id=>{const p=gameDemo.population.residents.find(p=>p.id===id).position.clone();p.y+=1.1;p.project(gameDemo.camera);return {x:(p.x*.5+.5)*innerWidth,y:(-.5*p.y+.5)*innerHeight};},guardId);
  await page.mouse.click(guardPoint.x,guardPoint.y);await frame();assert.equal(await page.evaluate(()=>gameDemo.state.lock?.id),guardId);
  await frame(15,.1);assert.ok(await page.evaluate(id=>gameDemo.population.residents.find(p=>p.id===id).target.hp,guardId)<160);
  // A point-blank low-health fixture exercises the real punch impact and respawn path.
  await page.evaluate(id=>{const g=gameDemo,p=g.population.residents.find(p=>p.id===id);p.position.copy(g.player.position);p.position.x+=.6;p.target.hp=12;g.combat.action=null;g.combat.stamina=100;g.combat.setTarget(p.target);g.combat.request('punch');g.combat.action.elapsed=.17;},guardId);
  await frame(1,.05);assert.equal(await page.evaluate(id=>gameDemo.population.residents.find(p=>p.id===id).target.hp,guardId),0);
  await page.evaluate(()=>{const g=gameDemo;g.selectEnemy(null);g.player.position.set(0,g.world.height(0,60),60);g.combat.hp=100;testNow+=46000;g.population.update(.1,g.player.position,testNow,false);});
  assert.ok(await page.evaluate(id=>gameDemo.population.residents.find(p=>p.id===id).target.hp,guardId)>0);
  await page.evaluate(()=>testNow+=20000);await page.click('#pvp-toggle');await page.evaluate(()=>testNow+=31000);await frame();assert.equal(await page.evaluate(()=>gameDemo.progress.data.pvp.enabled),false);
  console.log('Guard warning, timed enforcement, player retaliation, NPC respawn and outdoor flag cooldown verified');
  assert.deepEqual(errors,[]);
  await writeFile('test-results/society-woodcutting.json',JSON.stringify({woodcutting:{tree,fell,wood:3,requiresPurchasedAxe:true},factions,guards:'Warning → enforcement → player hit → defeat → respawn; safe outdoor flag cooldown',errors},null,2));
}finally{await browser.close();}
