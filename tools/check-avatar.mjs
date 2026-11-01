import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
const browser=await chromium.launch();
try {
  const page=await browser.newPage({viewport:{width:1400,height:1000}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  await page.goto('http://127.0.0.1:5173/avatar.html');
  await page.waitForFunction(()=>window.maleAvatar?.ready);
  const result=await page.evaluate(async()=>{
    const THREE=await import('/node_modules/three/build/three.module.js');
    const {avatar}=window.maleAvatar,mesh=avatar.body,positions=mesh.geometry.attributes.position;
    const w=mesh.geometry.attributes.skinWeight,idx=mesh.geometry.attributes.skinIndex;
    for(let i=0;i<w.count;i++){
      if(Math.abs(w.getX(i)+w.getY(i)+w.getZ(i)+w.getW(i)-1)>1e-5)throw Error('Invalid skin weights');
      for(const value of [idx.getX(i),idx.getY(i),idx.getZ(i),idx.getW(i)])if(value>=avatar.rig.skeleton.bones.length)throw Error('Invalid bone index');
    }
    if(avatar.underwear.skeleton!==mesh.skeleton)throw Error('Clothing uses a different rig');
    const joints={};
    for(const [name,bone] of Object.entries(avatar.rig.bones)){
      avatar.rig.reset();bone.rotation.z=.25;avatar.root.updateMatrixWorld(true);avatar.rig.skeleton.update();
      let moved=0;const v=new THREE.Vector3(),original=new THREE.Vector3();
      for(let i=0;i<positions.count;i++){
        original.fromBufferAttribute(positions,i);v.copy(original);mesh.applyBoneTransform(i,v);
        if(!Number.isFinite(v.lengthSq()))throw Error(`Nonfinite deformation: ${name}`);
        if(v.distanceToSquared(original)>1e-10)moved++;
      }
      if(!moved)throw Error(`Joint has no influence: ${name}`);
      joints[name]=moved;
    }
    avatar.rig.reset();avatar.rig.bones.upperArmL.rotation.z=-1.4;avatar.rig.bones.upperArmR.rotation.z=1.4;
    avatar.root.updateMatrixWorld(true);avatar.rig.skeleton.update();
    let chestDrift=0,elbowDrop=0;
    for(let i=0;i<positions.count;i++){
      const original=new THREE.Vector3().fromBufferAttribute(positions,i),posed=original.clone();mesh.applyBoneTransform(i,posed);
      if(Math.abs(original.x)<.12&&original.y>1.26&&original.y<1.48)chestDrift=Math.max(chestDrift,posed.distanceTo(original));
      if(Math.abs(original.x)>.48&&Math.abs(original.x)<.57&&original.y>1.35)elbowDrop=Math.max(elbowDrop,original.y-posed.y);
    }
    if(chestDrift>.001)throw Error(`Arms-down pose pulls chest by ${chestDrift}m`);
    if(elbowDrop<.2)throw Error('Arms-down regression: elbows did not lower');
    avatar.rig.reset();avatar.root.updateMatrixWorld(true);
    return {bones:avatar.rig.skeleton.bones.length,vertices:positions.count,triangles:mesh.geometry.index.count/3,joints,sharedClothingSkeleton:true,armsDown:{chestDriftMetres:chestDrift,elbowDropMetres:elbowDrop}};
  });
  for(let i=0;i<5;i++){
    await page.click(`[data-face="${i}"]`);await page.waitForTimeout(60);
    await page.screenshot({path:`test-results/male-face-${i}.png`});
  }
  await page.click('[data-face="0"]');
  for(const [name,color] of [['blue','#2277dd'],['green','#33bb55']]){
    await page.locator('#eye-color').fill(color);await page.locator('#eye-color').dispatchEvent('input');await page.waitForTimeout(60);
    await page.screenshot({path:`test-results/male-eyes-${name}.png`});
  }
  await page.click('#pose');await page.waitForTimeout(60);await page.screenshot({path:'test-results/male-joint-pose.png'});
  await page.click('#arms-down');await page.waitForTimeout(60);await page.screenshot({path:'test-results/male-arms-down.png'});
  if(errors.length)throw Error(errors.join('\n'));
  await writeFile('test-results/avatar-validation.json',JSON.stringify(result,null,2));
  console.log(`Verified ${result.bones} joints deform the real mesh with finite positions; five faces render; clothing shares the rig; no browser errors.`);
} finally {await browser.close();}
