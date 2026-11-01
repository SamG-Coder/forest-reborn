import {chromium} from '@playwright/test';
const browser=await chromium.launch({args:['--enable-gpu','--use-angle=d3d11','--disable-software-rasterizer']});
try{
 const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[];
 page.on('pageerror',e=>{errors.push(e.message);console.log('PAGE ERROR',e.message);});page.on('console',m=>{if(m.type()==='error'){errors.push(m.text());console.log('CONSOLE ERROR',m.text());}});
 console.log('Opening game');await page.goto('http://127.0.0.1:5173/game.html',{waitUntil:'domcontentloaded'});console.log('DOM loaded');
 try{await page.waitForFunction(()=>window.gameDemo?.ready,{},{timeout:60000});}catch(e){console.log(errors);throw e;}
 console.log('Game ready');await page.evaluate(()=>{gameDemo.renderer.setAnimationLoop(null);gameDemo.enter();gameDemo.frame(1/60);});console.log('First frame');
 for(const [name,position,eye,target]of [
  ['town',[0,0,17],[48,36,56],[0,1,-7]],
  ['tavern',[-19,0,-17],[-18,2.6,-14],[-20,1,-22]],
  ['forest',[65,0,60],[68,3.5,75],[75,1.5,55]],
  ['goblin',[80,0,-72],[79,1.8,-74],[78,.7,-78]],
  ['hair',[0,0,17],[.5,1.7,18.2],[0,1.65,17]],
 ]){
  const result=await page.evaluate(({name,position,eye,target})=>{
   const g=gameDemo;g.player.position.set(...position);g.avatar.root.position.copy(g.player.position);g.avatar.root.rotation.y=0;
   g.player.yaw=0;for(let i=0;i<50;i++)g.frame(1/60);
   const height=g.world.height(position[0],position[2]);if(name!=='town'){eye[1]+=height;target[1]+=height;}
   g.camera.position.set(...eye);g.camera.lookAt(...target);g.renderer.render(g.scene,g.camera);
   document.querySelector('#hud').hidden=true;
   return {draws:g.renderer.info.render.calls,triangles:g.renderer.info.render.triangles,chunks:g.world.forest.stats(),residents:g.population.residents.length};
  },{name,position,eye,target});
  await page.screenshot({path:`test-results/world-${name}.png`});console.log(name,result);
 }
 console.log({errors});
}finally{await browser.close();}
