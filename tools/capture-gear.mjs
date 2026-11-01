import {chromium} from '@playwright/test';
import {mkdir} from 'node:fs/promises';

const browser=await chromium.launch({args:['--enable-gpu','--use-angle=d3d11','--disable-software-rasterizer']});
try {
  const page=await browser.newPage({viewport:{width:1500,height:1000}});
  await page.goto('http://127.0.0.1:5173/gear.html');
  await page.waitForFunction(()=>window.gearLab?.ready);
  await page.evaluate(({mode,preset})=>{
    const g=gearLab;g.renderer.setAnimationLoop(null);
    document.querySelector(`[data-preset=${preset}]`).click();
    g.avatar.rig.reset();g.animator.time=0;g.setMode(mode);
    for(let i=0;i<180;i++)g.advance(1/60);
  },{mode:process.argv[2]??'idle',preset:process.argv[3]??'cloth'});
  await mkdir('test-results',{recursive:true});
  for(const [name,position] of Object.entries({front:[1.8,2.4,2.8],back:[1.8,2.4,-2.8],side:[3,1.4,0],collar:[.7,2.15,-1.1],head:[1.3,1.65,0],face:[0,1.65,1.3]})){
    await page.evaluate(({name,position})=>{
      const g=gearLab;g.camera.position.set(...position);
      g.avatar.equipment.get('weapon.practice-sword').mesh.visible=!['head','face','collar'].includes(name);
      g.camera.lookAt(0,name==='collar'?1.4:['head','face'].includes(name)?1.57:.98,0);
      g.camera.updateMatrixWorld();g.renderer.render(g.scene,g.camera);
    },{name,position});
    await page.screenshot({path:`test-results/gear-${process.argv[3]??'cloth'}-${process.argv[2]??'idle'}-${name}.png`});
  }
  console.log(await page.evaluate(()=>gearLab.equipment.stats()));
} finally {await browser.close();}
