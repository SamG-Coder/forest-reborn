import {chromium} from '@playwright/test';
const browser=await chromium.launch({args:['--enable-gpu','--use-angle=d3d11','--disable-software-rasterizer']});
try{
 const page=await browser.newPage({viewport:{width:1400,height:1000}});await page.goto('http://127.0.0.1:5173/gear.html');await page.waitForFunction(()=>window.gearLab?.ready);
 await page.evaluate(()=>{gearLab.renderer.setAnimationLoop(null);gearLab.setMode('idle');for(let i=0;i<90;i++)gearLab.advance(1/60);});
 for(const [name,offset]of Object.entries({palm:[.08,-.29,.12],thumb:[.03,-.15,.29],back:[.06,.29,.12]})){
  await page.evaluate(async offset=>{
   const T=await import('/node_modules/three/build/three.module.js'),g=gearLab,hand=g.avatar.rig.bones.handR;
   const socket=g.avatar.root.getObjectByName('socket.rightPalmGrip'),target=socket.getWorldPosition(new T.Vector3());
   g.camera.position.copy(target).add(new T.Vector3(...offset).applyQuaternion(hand.getWorldQuaternion(new T.Quaternion())));
   g.camera.lookAt(target);g.renderer.render(g.scene,g.camera);
  },offset);await page.screenshot({path:`test-results/hand-${name}.png`});
 }
}finally{await browser.close();}
