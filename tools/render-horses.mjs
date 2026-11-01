import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
await mkdir('public/assets/mounts',{recursive:true});
const browser=await chromium.launch({args:['--enable-gpu','--use-angle=d3d11']});
try{
  const page=await browser.newPage();await page.goto('http://127.0.0.1:5173/creatures.html');
  const images=await page.evaluate(async()=>{
    const THREE=await import('/node_modules/three/build/three.module.js'),{createHorse}=await import('/src/mounts/horse-model.js');
    const scene=new THREE.Scene();scene.add(new THREE.HemisphereLight('#fff5e4','#57675c',2));const light=new THREE.DirectionalLight('#ffffff',2.5);light.position.set(-3,5,5);scene.add(light);
    const camera=new THREE.PerspectiveCamera(36,1,.1,20);camera.position.set(3.3,2.3,4);camera.lookAt(0,1.1,.15);
    const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});renderer.setSize(512,512);const result={};
    for(const id of ['bay','grey','chestnut']){const horse=createHorse({id});scene.add(horse.root);renderer.render(scene,camera);result[id]=renderer.domElement.toDataURL('image/png').split(',')[1];horse.dispose();}
    renderer.dispose();return result;
  });
  for(const [id,data]of Object.entries(images))await writeFile(`public/assets/mounts/${id}.png`,Buffer.from(data,'base64'));
  console.log('Rendered three catalogue portraits from the actual 3D horse models.');
}finally{await browser.close();}
