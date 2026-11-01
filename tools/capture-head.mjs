import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
const stage=process.argv[2]??'fitted';
if(!['baseline','fitted'].includes(stage))throw new Error('Stage must be baseline or fitted');
const directory=path.resolve('public/validation');await mkdir(directory,{recursive:true});
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage();await page.goto('http://127.0.0.1:5173/compare.html');await page.waitForFunction(()=>window.captureReady);
 for(const view of ['front','threeQuarter','profile'])for(const mode of ['mask','texture','depth']){
  const url=await page.evaluate(([v,m])=>window.captureHead(v,m),[view,mode]);
  await writeFile(path.join(directory,`${stage}-${view}-${mode}.png`),Buffer.from(url.split(',')[1],'base64'));
 }
 console.log(`Captured actual Three.js head: ${stage}`);
}finally{await browser.close();}
