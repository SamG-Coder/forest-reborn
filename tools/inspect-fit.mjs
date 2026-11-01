import {chromium} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch();
try{
  const page=await browser.newPage();await page.goto('http://127.0.0.1:5173/gear.html');await page.waitForFunction(()=>window.gearLab?.ready);
  const result=await page.evaluate(()=>{
    gearLab.renderer.setAnimationLoop(null);
    const g=gearLab.avatar.body.geometry,p=g.attributes.position,idx=gearLab.equipment.bodyCoverage.original;
    const slices=[];
    for(const y of [1.46,1.48,1.50,1.52,1.54,1.56,1.58,1.60,1.66,1.70,1.74]){
      const points=[];
      for(let i=0;i<idx.length;i+=3)for(const [a,b]of[[idx[i],idx[i+1]],[idx[i+1],idx[i+2]],[idx[i+2],idx[i]]]){
        if((p.getY(a)-y)*(p.getY(b)-y)>=0)continue;
        const t=(y-p.getY(a))/(p.getY(b)-p.getY(a));
        const x=p.getX(a)+(p.getX(b)-p.getX(a))*t,z=p.getZ(a)+(p.getZ(b)-p.getZ(a))*t;
        if(Math.abs(x)<.13)points.push([x,z]);
      }
      slices.push({y,minX:Math.min(...points.map(p=>p[0])),maxX:Math.max(...points.map(p=>p[0])),minZ:Math.min(...points.map(p=>p[1])),maxZ:Math.max(...points.map(p=>p[1]))});
    }
    g.computeBoundingBox();return{slices,top:g.boundingBox.max.y};
  });
  console.log(result);await writeFile('public/models/gear-fit-profile.json',JSON.stringify(result,null,2));
}finally{await browser.close();}
