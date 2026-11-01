import {chromium} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({args:['--enable-gpu','--use-angle=d3d11','--disable-software-rasterizer']}),page=await browser.newPage();
await page.goto('http://127.0.0.1:5173/gear.html');await page.waitForFunction(()=>window.gearLab?.ready);
const data=await page.evaluate(()=>{
  const {avatar,equipment,renderer}=gearLab;renderer.setAnimationLoop(null);
  document.querySelector('[data-preset=cloth]').click();
  const source={position:[],normal:[],index:[],color:[],skinIndex:[],skinWeight:[]};
  const meshes=[avatar.body,...[...equipment.entries.values()].flatMap(e=>e.meshes).filter(m=>m.visible)];
  for(const mesh of meshes){
    const g=mesh.geometry,offset=source.position.length/3;
    const patch=[...equipment.entries.values()].flatMap(e=>e.patches).find(p=>p.geometry===g);
    source.position.push(...(patch?patch.rest.flatMap(p=>p.toArray()):g.attributes.position.array));
    source.normal.push(...g.attributes.normal.array);source.skinIndex.push(...g.attributes.skinIndex.array);source.skinWeight.push(...g.attributes.skinWeight.array);
    for(let i=0;i<g.attributes.position.count;i++)source.color.push(...mesh.material.color.toArray());
    source.index.push(...Array.from(g.index.array,i=>i+offset));
  }
  return source;
});
await writeFile('public/models/crowd-source.json',JSON.stringify(data));await browser.close();
console.log({vertices:data.position.length/3,triangles:data.index.length/3});
