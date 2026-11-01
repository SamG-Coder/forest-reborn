import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
await mkdir('test-results',{recursive:true});
const browser=await chromium.launch({args:['--enable-gpu','--use-angle=d3d11','--disable-software-rasterizer']});
try{
  const page=await browser.newPage({viewport:{width:1540,height:980}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://127.0.0.1:5173/game.html?revision=combat-spacing-17');
  await page.waitForFunction(()=>window.gameDemo?.ready,null,{timeout:60000});
  await page.evaluate(()=>{gameDemo.renderer.setAnimationLoop(null);window.testNow=Date.now();Date.now=()=>testNow;});
  await page.click('#enter');
  const chase=await page.evaluate(()=>{
    const g=gameDemo,guards=g.population.residents.filter(p=>p.type==='guard');window.testGuards=guards;
    g.simulation.society.nextEventAt=testNow+999999;g.simulation.society.nextFormationAt=testNow+999999;
    for(const p of g.population.residents){p.routine=null;p.target.hp=0;p.respawnAt=testNow+999999;p.actor.root.visible=false;}
    for(const [i,p]of guards.entries()){p.target.hp=p.maxHp;p.position.set(-1+i*.15,g.world.height(0,22),22);p.threat=g.population.living.player.target;p.threatUntil=testNow+999999;}
    g.player.position.set(0,g.world.height(0,29),29);g.player.velocity.set(0,0,0);g.combat.hp=10000;g.combat.random=()=>1;
    g.progress.data.pvp.enabled=true;g.progress.data.pvp.wantedUntil=testNow+999999;
    g.state.cameraYaw=0;g.state.cameraPitch=.55;g.state.cameraDistance=7;g.followCamera.reset();
    let incoming=false,minimumSeparation=Infinity;
    for(let i=0;i<720;i++){
      testNow+=1000/60;if(i<300)g.player.position.z+=.013;
      g.frame(1/60);
      incoming ||= Boolean(document.querySelector('#damage-numbers>.incoming:not([hidden])'));
      if(i>600)for(let a=0;a<guards.length;a++)for(let b=0;b<a;b++)minimumSeparation=Math.min(minimumSeparation,guards[a].position.distanceTo(guards[b].position));
    }
    return {incoming,minimumSeparation,hpLost:10000-g.combat.hp,guards:guards.map(p=>({id:p.id,position:p.position.toArray(),range:p.position.distanceTo(g.player.position),strikes:p.strikes??0})),player:g.player.position.toArray()};
  });
  console.log('Group chase:',JSON.stringify(chase));
  assert.ok(chase.incoming&&chase.hpLost>0);assert.ok(chase.minimumSeparation>.6);
  assert.ok(chase.guards.every(g=>g.strikes>0&&g.range<=2.5));
  await page.evaluate(()=>{gameDemo.combat.hp=100;gameDemo.frame(0);});
  await page.screenshot({path:'test-results/group-combat.png'});
  const numbers=await page.evaluate(()=>{
    const g=gameDemo,a=testGuards[0],b=testGuards[1];
    g.progress.data.pvp.enabled=false;g.progress.data.pvp.wantedUntil=0;
    g.population.living.law.warnings.clear();g.population.living.law.hostiles.clear();
    for(const p of testGuards){p.threat=null;p.attack=null;p.intent=null;}
    a.position.set(-.8,g.world.height(-.8,32),32);b.position.set(.8,g.world.height(.8,32),32);
    b.target.hp=9;a.nextStrikeAt=0;a.intent={type:'fight',target:b.target};
    g.population.living.behaviour(a,.4,testNow);g.frame(1/60);
    const world=[...document.querySelectorAll('#damage-numbers>.world')].map(e=>({text:e.textContent,target:e.dataset.target,hidden:e.hidden}));
    g.progress.addItem('sword');g.weapon('sword');g.progress.data.pvp.enabled=true;
    g.selectEnemy(a.target);g.combat.stamina=100;g.combat.action=null;g.combat.block=false;g.combat.blockTime=0;
    a.target.hp=100;a.position.copy(g.player.position);a.position.z-=1.4;a.threat=null;
    g.requestAttack('sword');for(let i=0;i<24;i++){testNow+=1000/60;g.frame(1/60);}
    const outgoing=[...document.querySelectorAll('#damage-numbers>.outgoing')].map(e=>({text:e.textContent,target:e.dataset.target,hidden:e.hidden}));
    return {world,outgoing};
  });
  console.log('Combat text:',JSON.stringify(numbers));
  assert.ok(numbers.world.some(n=>n.text==='9'&&!n.hidden));assert.ok(numbers.outgoing.some(n=>Number(n.text)>0&&!n.hidden));
  await page.screenshot({path:'test-results/combat-damage-numbers.png'});
  await page.evaluate(async()=>{
    const T=await import('/node_modules/three/build/three.module.js'),g=gameDemo;
    g.avatar.root.position.set(0,0,0);g.avatar.root.rotation.set(0,0,0);g.equipment.sword.visible=true;
    for(const child of g.scene.children)if(child!==g.avatar.root&&!child.isLight)child.visible=false;
    g.scene.background=new T.Color('#dce3dc');g.scene.fog=null;
    g.renderer.shadowMap.enabled=false;g.renderer.setPixelRatio(1);g.renderer.setSize(220,340);g.camera.aspect=220/340;g.camera.fov=45;g.camera.updateProjectionMatrix();g.camera.position.set(.25,1.7,3.1);g.camera.lookAt(0,1.0,.1);
    const sheet=document.createElement('canvas');sheet.id='audit';sheet.width=1540;sheet.height=680;const ctx=sheet.getContext('2d');
    for(let row=0;row<2;row++)for(let col=0;col<7;col++){
      const phase=[0,.24,.34,.43,.54,.65,.9][col],action={kind:'sword',style:'cut',combo:row,height:1.25,progress:0};
      for(let i=0;i<90;i++)g.animator.update(1/60,{speed:0,weapon:'sword'});
      for(let i=0;i<=Math.round(phase*120);i++){action.progress=i/120;g.animator.update(1/120,{speed:0,weapon:'sword',action});}
      g.wardrobe.update(0);g.renderer.render(g.scene,g.camera);ctx.drawImage(g.renderer.domElement,col*220,row*340);ctx.fillStyle='#182f2d';ctx.font='15px sans-serif';ctx.fillText(`${row?'Backhand':'Forehand'} ${phase}`,col*220+8,row*340+22);
    }
    document.body.replaceChildren(sheet);sheet.style.cssText='position:fixed;left:0;top:0;width:1540px;height:680px';
  });
  await page.locator('#audit').screenshot({path:'test-results/sword-two-cut-cycle.png'});
  assert.deepEqual(errors,[]);await writeFile('test-results/combat-update.json',JSON.stringify({chase,numbers,errors},null,2));
}finally{await browser.close();}
