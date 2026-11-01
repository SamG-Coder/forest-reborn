import {chromium} from '@playwright/test';
const browser=await chromium.launch({args:['--enable-gpu','--use-angle=d3d11','--disable-software-rasterizer']});
try{
 const page=await browser.newPage();await page.goto('http://127.0.0.1:5173/gear.html');await page.waitForFunction(()=>window.gearLab?.ready);
 console.log(await page.evaluate(async()=>{
   const T=await import('/node_modules/three/build/three.module.js'),g=gearLab;g.renderer.setAnimationLoop(null);let peak={ratio:0};
   for(const preset of ['cloth','mail','plate']){document.querySelector(`[data-preset=${preset}]`).click();
   for(const mode of ['idle','walk','run','slash','thrust','punch','jump','guard']){g.setMode(mode);for(let frame=0;frame<180;frame++){g.advance(1/60);
     for(const e of g.equipment.entries.values())for(const p of e.patches)for(const c of p.constraints){const ratio=p.positions[c.a].distanceTo(p.positions[c.b])/c.length;if(ratio>peak.ratio)peak={ratio,preset,mode,frame,a:c.a,b:c.b,bend:c.bend,rest:c.length,pa:p.positions[c.a].toArray(),pb:p.positions[c.b].toArray(),ta:p.pinTarget(c.a,new T.Vector3()).toArray(),tb:p.pinTarget(c.b,new T.Vector3()).toArray(),side:p.side};}
   }}g.setMode('idle');for(let i=0;i<90;i++)g.advance(1/60);}return peak;
 }));
}finally{await browser.close();}
