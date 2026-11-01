import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';

const browser=await chromium.launch({args:['--enable-gpu','--use-angle=d3d11','--disable-software-rasterizer']});
try{
  const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[],missing=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)missing.push(r.url());});
  await page.goto('http://127.0.0.1:5173/game.html?revision=mosswake-19');await page.waitForFunction(()=>window.gameDemo?.ready,null,{timeout:60000});
  await page.evaluate(()=>{gameDemo.renderer.setAnimationLoop(null);window.testNow=Date.now();Date.now=()=>testNow;});await page.click('#enter');
  const frames=async(n=1)=>page.evaluate(n=>{for(let i=0;i<n;i++){testNow+=1000/60;gameDemo.frame(1/60);}},n);
  const routes=await page.evaluate(()=>{
    const g=gameDemo,nav=g.population.navigation;
    return g.world.workstations.stations.map(s=>{const route=nav.route(g.player.position,s.position);let from=g.player.position,clear=true;for(const p of route){if(!nav.segmentClear(from,p))clear=false;from=p;}return {id:s.id,points:route.length,clear,walkable:nav.walkable(s.position.x,s.position.z,.3)};});
  });console.log({routes});assert.ok(routes.every(r=>r.points>0&&r.clear&&r.walkable));
  const recipeIds={weaver:'yarn',forge:'ingot',alchemy:'healing',kitchen:'broth',carpenter:'planks',leatherworker:'leather'},results=[];
  for(const [id,recipeId]of Object.entries(recipeIds)){
    const walk=await page.evaluate(id=>{
      const g=gameDemo,station=g.world.workstations.get(id),route=g.population.navigation.route(g.player.position,station.position);let steps=0;
      g.selectEnemy(null);g.worldUI.close();g.input.keys.add('KeyW');
      for(const point of route){let n=0;while(Math.hypot(point.x-g.player.position.x,point.z-g.player.position.z)>.2&&n++<1200){g.state.cameraYaw=Math.atan2(g.player.position.x-point.x,g.player.position.z-point.z);testNow+=50;g.frame(.05);steps++;}if(n>=1200)break;}
      g.input.keys.clear();for(let i=0;i<25;i++){testNow+=50;g.frame(.05);}g.state.cameraYaw=station.angle+.55;g.state.cameraPitch=.62;g.state.cameraDistance=4;g.followCamera.reset();g.frame(1/60);
      return {id,steps,distance:Math.hypot(station.position.x-g.player.position.x,station.position.z-g.player.position.z),canUse:station.canUse(g.player.position)};
    },id);console.log({walk});assert.ok(walk.canUse,JSON.stringify(walk));
    await page.screenshot({path:`test-results/workshop-world-${id}.png`});
    const recipe=await page.evaluate(async recipeId=>{
      const {RECIPES}=await import('/src/progression/recipes.js'),r=RECIPES.find(r=>r.id===recipeId);for(const [id,count]of Object.entries(r.ingredients))gameDemo.progress.addItem(id,count);return r;
    },recipeId);
    await page.keyboard.press('KeyV');await page.getByRole('button',{name:'Select '+recipe.name,exact:true}).click();
    assert.ok(await page.getByRole('button',{name:'Craft '+recipe.name,exact:true}).isEnabled());
    const overflow=await page.locator('.world-panel').first().evaluate(e=>e.scrollWidth>e.clientWidth+1);assert.equal(overflow,false);
    await page.screenshot({path:`test-results/workshop-menu-${id}.png`});
    await page.getByRole('button',{name:'Craft '+recipe.name,exact:true}).click();await frames(Math.ceil(recipe.duration*60)+10);
    const made=await page.evaluate(id=>gameDemo.progress.hasItem(id),recipe.output);assert.equal(made,true);results.push({...walk,output:recipe.output});
  }
  await page.evaluate(()=>{const g=gameDemo,p=g.population.residents.find(p=>p.id==='trader');g.player.position.copy(p.position);g.player.position.z+=1.5;g.player.velocity.set(0,0,0);g.followCamera.reset();});await frames(2);await page.keyboard.press('KeyV');
  assert.equal(await page.locator('[data-tab="craft"]').count(),0);await page.locator('[data-tab="buy"]').click();await page.screenshot({path:'test-results/shop-cards.png'});assert.ok(await page.locator('.shop-card .item-art').count()>5);await page.locator('.panel-close').first().click();
  await page.keyboard.press('KeyL');await page.screenshot({path:'test-results/quest-journal-cards.png'});assert.ok(await page.locator('.journal-choice .item-art').count()>0);await page.locator('.panel-close').first().click();
  await page.keyboard.press('KeyK');await page.screenshot({path:'test-results/skill-cards.png'});assert.equal(await page.locator('.skill-row .item-art').count(),13);await page.locator('.close-player-panel').click();
  const berry=await page.evaluate(()=>{const g=gameDemo,n=g.world.resources.ledger.nodes.find(n=>n.kind==='berries'),root=g.world.resources.roots.get(n.id);g.player.position.set(n.x,g.world.height(n.x,n.z+2),n.z+2);g.player.velocity.set(0,0,0);g.state.cameraYaw=.5;g.state.cameraPitch=.3;g.state.cameraDistance=3;g.followCamera.reset();return {width:root.children[0].material.map.image.width,cards:root.children.length};});await frames(5);await page.screenshot({path:'test-results/berry-foliage.png'});assert.ok(berry.width>=1024);assert.equal(berry.cards,3);
  assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);await writeFile('test-results/workshops.json',JSON.stringify({routes,results,berry,errors,missing},null,2));console.log({results,berry,errors,missing});
}finally{await browser.close();}
