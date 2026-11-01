import { chromium } from '@playwright/test';
const browser=await chromium.launch();
const page=await browser.newPage({viewport:{width:1200,height:900}});
page.on('pageerror',e=>console.error(e));
await page.goto('http://127.0.0.1:5173/game.html');
await page.waitForFunction(()=>window.gameDemo?.ready);
await page.click('#enter');
await page.waitForTimeout(500);
await page.evaluate(()=>{const g=window.gameDemo;g.renderer.setAnimationLoop(null);document.querySelector('#hud').hidden=true;g.avatar.root.position.set(0,0,0);g.avatar.root.rotation.y=0;g.camera.position.set(2.2,1.6,3.4);g.camera.lookAt(0,1,0);});
for(const [name,state] of Object.entries({idle:{speed:0,weapon:'sword'},walk:{speed:1.45,weapon:'sword'},run:{speed:3.9,weapon:'sword'},guard:{speed:0,weapon:'sword',block:true},windup:{speed:0,weapon:'sword',action:{kind:'sword',progress:.28,combo:0,height:1.25}},follow:{speed:0,weapon:'sword',action:{kind:'sword',progress:.64,combo:0,height:1.25}},strike:{speed:0,weapon:'sword',action:{kind:'sword',progress:.46,combo:0,height:1.25}}})){
await page.evaluate(state=>{const g=window.gameDemo;for(let i=0;i<60;i++)g.animator.update(1/60,{...state,grounding:false});g.renderer.render(g.scene,g.camera);},state);
await page.screenshot({path:`test-results/animation-${name}.png`});
}
await browser.close();
