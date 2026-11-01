/** Optimize the cross-section against actual Three.js renders of the third view. */
import {chromium} from 'playwright';
import {readFile,writeFile} from 'node:fs/promises';
const file='src/fitting/head-fit.json',fit=JSON.parse(await readFile(file,'utf8'));
const browser=await chromium.launch();const trials=[];
try{
 const page=await browser.newPage();
 for(const angle of [20,25,30,35])for(const exponent of [.10,.15,.20,.26]){
  fit.frontExponent=exponent;fit.threeQuarterAngle=angle;await writeFile(file,JSON.stringify(fit,null,2));
  await page.goto('http://127.0.0.1:5173/compare.html');await page.waitForFunction(()=>window.captureReady);
  const iou=await page.evaluate(async()=>{
   async function pixels(url){const image=new Image();image.src=url;await image.decode();const c=document.createElement('canvas');c.width=c.height=512;const ctx=c.getContext('2d');ctx.drawImage(image,0,0);return ctx.getImageData(0,0,512,512).data;}
   const target=await pixels('/validation/reference-threeQuarter-mask.png');const model=await pixels(window.captureHead('threeQuarter','mask'));
   let intersection=0,union=0;for(let i=0;i<target.length;i+=4){const a=target[i]>127,b=model[i]<127;intersection+=a&&b?1:0;union+=a||b?1:0;}return intersection/union;
  });
  trials.push({exponent,angle,iou});console.log({exponent,angle,iou});
 }
 trials.sort((a,b)=>b.iou-a.iou);fit.frontExponent=trials[0].exponent;fit.threeQuarterAngle=trials[0].angle;fit.heldOutView=null;fit.optimization={method:'Joint cross-section and camera yaw grid search against rendered third-view silhouette IoU',trials};await writeFile(file,JSON.stringify(fit,null,2));
}finally{await browser.close();}

