import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const browser=await chromium.launch({args:['--enable-gpu','--use-angle=d3d11','--disable-software-rasterizer']});
const page=await browser.newPage({viewport:{width:1500,height:1000}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.goto('http://127.0.0.1:5173/gear.html');await page.waitForFunction(()=>window.gearLab?.ready);
const report=await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js'),g=gearLab;g.renderer.setAnimationLoop(null);
  const results=[];
  for(const preset of ['cloth','mail','plate']){
    document.querySelector(`[data-preset=${preset}]`).click();
    for(const mode of ['idle','walk','run','slash','thrust','punch','jump','guard']){
      g.setMode(mode);let peakStretch=1,seamError=0;for(let i=0;i<180;i++){g.advance(1/60);if(i%6===0)peakStretch=Math.max(peakStretch,g.equipment.stats().maxStretch);}
      for(const entry of g.equipment.entries.values())for(const patch of entry.patches)for(let i=0;i<patch.positions.length;i++)if(!patch.inverseMass[i])seamError=Math.max(seamError,patch.positions[i].distanceTo(patch.pinTarget(i,new T.Vector3())));
      let nonfinite=0,maximum=0;
      for(const entry of g.equipment.entries.values())for(const mesh of entry.meshes){
        const pos=mesh.geometry.attributes.position;
        for(let i=0;i<pos.count;i++){const p=new T.Vector3().fromBufferAttribute(pos,i);if(mesh.isSkinnedMesh)mesh.applyBoneTransform(i,p);if(!p.toArray().every(Number.isFinite))nonfinite++;maximum=Math.max(maximum,p.length());}
      }
      results.push({preset,mode,...g.equipment.stats(),peakStretch,seamError,nonfinite,maximum});
    }
    g.setMode('idle');for(let i=0;i<90;i++)g.advance(1/60);g.renderer.render(g.scene,g.camera);
  }
  const neck=g.equipment.entries.get('necklace');const necklaceVisible=neck.meshes.filter(m=>m.name.endsWith('.pendant')).some(m=>m.geometry.index.count>0);
  g.equipment.unequip('body');const necklaceRestored=g.equipment.entries.get('necklace').meshes.some(m=>m.geometry.index.count>0);
  const before=g.equipment.ids();let rejected=false;try{g.equipment.apply(['clothes.traveller-blue','clothes.traveller-red']);}catch{rejected=true;}
  return {results,necklaceVisible,necklaceRestored,rejected,unchanged:JSON.stringify(before)===JSON.stringify(g.equipment.ids())};
});
await mkdir('public/validation/gear',{recursive:true});await writeFile('public/validation/gear/animation-check.json',JSON.stringify({...report,errors},null,2));
assert.ok(report.results.every(r=>r.nonfinite===0&&r.maximum<3));assert.ok(report.results.every(r=>r.peakStretch<1.5&&r.seamError<1e-6),JSON.stringify(report.results.filter(r=>r.peakStretch>=1.5||r.seamError>=1e-6)));
assert.equal(report.necklaceVisible,false);assert.equal(report.necklaceRestored,true);assert.ok(report.rejected&&report.unchanged);assert.deepEqual(errors,[]);
for(const preset of ['cloth','mail','plate']){
 await page.evaluate(preset=>{document.querySelector(`[data-preset=${preset}]`).click();gearLab.setMode('idle');for(let i=0;i<90;i++)gearLab.advance(1/60);gearLab.renderer.render(gearLab.scene,gearLab.camera);},preset);
 await page.screenshot({path:`test-results/gear-${preset}.png`});
}
console.log({poses:report.results.length,maxStretch:Math.max(...report.results.map(r=>r.peakStretch)),necklaceRestored:report.necklaceRestored,errors});await browser.close();
