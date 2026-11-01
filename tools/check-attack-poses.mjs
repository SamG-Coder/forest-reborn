import {chromium} from '@playwright/test';
const browser=await chromium.launch();const page=await browser.newPage({viewport:{width:1280,height:1120}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://127.0.0.1:5173/game.html?revision=attack-grip-11');await page.waitForFunction(()=>window.gameDemo?.ready);
await page.evaluate(async()=>{
 const T=await import('/node_modules/three/build/three.module.js'),g=gameDemo;
 g.renderer.setAnimationLoop(null);g.avatar.root.position.set(0,0,0);g.avatar.root.rotation.set(0,0,0);
 for(const child of g.scene.children)if(child!==g.avatar.root&&!child.isLight)child.visible=false;
 g.scene.background=new T.Color('#dce3dc');g.renderer.setPixelRatio(1);g.renderer.setSize(320,280);g.camera.aspect=320/280;g.camera.updateProjectionMatrix();g.camera.position.set(1.5,1.7,3);g.camera.lookAt(0,1.25,.2);
 const sheet=document.createElement('canvas');sheet.id='audit';sheet.width=1280;sheet.height=1120;const ctx=sheet.getContext('2d');
 const poses=[['Forehand','cut',0],['Backhand','cut',1],['Overhead','cut',2],['Thrust','thrust',0]];
 for(let row=0;row<4;row++)for(let col=0;col<4;col++){
  const [label,style,combo]=poses[row],phase=[.25,.45,.60,.85][col],action={kind:'sword',style,combo,height:1.25,progress:0};
  for(let i=0;i<60;i++)g.animator.update(1/60,{speed:0,weapon:'sword'});
  for(let i=0;i<=Math.round(phase*120);i++){action.progress=i/120;g.animator.update(1/120,{speed:0,weapon:'sword',action});}
  g.renderer.render(g.scene,g.camera);ctx.drawImage(g.renderer.domElement,col*320,row*280);ctx.fillStyle='#182f2d';ctx.font='15px sans-serif';ctx.fillText(`${label} ${phase}`,col*320+10,row*280+22);
 }
 document.body.replaceChildren(sheet);sheet.style.cssText='position:fixed;left:0;top:0;width:1280px;height:1120px';
});
await page.locator('#audit').screenshot({path:'test-results/attack-pose-audit.png'});console.log({errors});await browser.close();
