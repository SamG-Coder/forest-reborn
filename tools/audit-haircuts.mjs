import {chromium} from '@playwright/test';
import {writeFile,mkdir} from 'node:fs/promises';
const browser=await chromium.launch({args:['--enable-gpu','--use-angle=d3d11','--disable-software-rasterizer']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5173/game.html');await page.locator('#new-save').click();await page.waitForFunction(()=>window.gameDemo?.ready,null,{timeout:90000});
 await page.evaluate(()=>gameDemo.renderer.setAnimationLoop(null));
 const result=await page.evaluate(async()=>{
  const {hairChoices,HAIR_STYLES}=await import('/src/hair/catalog.js'),g=gameDemo,images=[],stats=[];
  g.renderer.setSize(240,240,false);g.renderer.setPixelRatio(1);g.avatar.root.position.set(0,0,0);g.avatar.root.rotation.set(0,0,0);g.avatar.root.scale.setScalar(1);g.camera.aspect=1;g.camera.fov=35;g.camera.updateProjectionMatrix();g.avatar.hair.setColor('#70523c');
  for(const gender of ['male','female']){
   g.avatar.bodySystem.setType(gender);
   for(const style of hairChoices(gender))for(const hat of [false,true]){
    g.wardrobe.apply(hat?['modern.tshirt','head.iron-open']:['modern.tshirt']);g.avatar.hair.setStyle(style);g.avatar.hair.setHeadwear(hat?g.wardrobe.entries.get('head').definition:null);
    for(const [view,pos] of [['front',[.035,1.67,.85]],['side',[.85,1.67,0]],['back',[0,1.67,-.85]]]){
     if(hat&&view==='back')continue;
     g.camera.position.set(...pos);g.camera.lookAt(0,1.62,0);g.renderer.render(g.avatar.root.parent,g.camera);
     images.push({gender,style,name:HAIR_STYLES[style],hat,view,url:g.renderer.domElement.toDataURL('image/png')});
    }
    stats.push({gender,style,hat,triangles:g.avatar.hair.meshes.reduce((n,m)=>n+m.geometry.index.count/3,0),finite:g.avatar.hair.meshes.every(m=>Array.from(m.geometry.attributes.position.array).every(Number.isFinite))});
   }
  }
  return {images,stats};
 });
 await mkdir('test-results/hair-audit',{recursive:true});
 for(const item of result.images)await writeFile(`test-results/hair-audit/${item.gender}-${item.style}-${item.hat?'helmet-':''}${item.view}.png`,Buffer.from(item.url.split(',')[1],'base64'));
 for(const gender of ['male','female'])for(const hat of [false,true]){
  const images=result.images.filter(i=>i.gender===gender&&i.hat===hat),sheet=await page.evaluate(async images=>{
   const canvas=document.createElement('canvas'),views=images[0].hat?2:3,w=150,h=172;canvas.width=views*w*3;canvas.height=h*4;const ctx=canvas.getContext('2d');ctx.fillStyle='#142a36';ctx.fillRect(0,0,canvas.width,canvas.height);
   for(let i=0;i<images.length;i++){const item=images[i],img=new Image();img.src=item.url;await img.decode();const style=Math.floor(i/views),view=i%views,x=(style%3)*views*w+view*w,y=Math.floor(style/3)*h;ctx.drawImage(img,x,y,w,150);ctx.fillStyle='#e8e1d0';ctx.font='12px sans-serif';ctx.fillText(`${item.name} · ${item.view}`,x+4,y+164);}
   return canvas.toDataURL('image/png');
  },images);await writeFile(`test-results/hair-audit-${gender}${hat?'-helmet':''}.png`,Buffer.from(sheet.split(',')[1],'base64'));
 }
 await writeFile('test-results/hair-audit.json',JSON.stringify({stats:result.stats,errors},null,2));console.log({renders:result.images.length,errors});
}finally{await browser.close();}
