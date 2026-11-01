import {chromium} from '@playwright/test';
import {writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
await mkdir('test-results/factions',{recursive:true});
const browser=await chromium.launch({args:['--enable-gpu','--use-angle=d3d11']});
try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto('http://127.0.0.1:5173/');await page.locator('#new-save').click();await page.waitForFunction(()=>window.gameDemo?.ready,null,{timeout:120000});
  await page.evaluate(()=>{const g=gameDemo;g.renderer.setAnimationLoop(null);g.voices.setMuted(true);g.enter();g.opening.finish();g.progress.data.mounts=['bay'];g.progress.data.activeMount='bay';g.progress.data.level=15;g.player.position.set(0,g.world.height(0,-55),-55);g.player.speed=0;g.player.velocity.set(0,0,0);g.frame(.016);});
  await page.keyboard.press('h');assert.equal(await page.evaluate(()=>gameDemo.mounts.mounted),true);
  const results=[];
  for(const weapon of ['sword','weapon.spear','weapon.greatsword','weapon.shortshield']){
    const result=await page.evaluate(async weapon=>{
      const g=gameDemo,Vector3=g.player.position.constructor,{SWORD_GRIP}=await import('/src/game/weapon-sockets.js');
      const target=g.world.targets.find(a=>a.kind==='goblin');g.selectEnemy(null);g.combat.reset();g.combat.random=()=>1;g.progress.addItem(weapon);g.weapon(weapon);
      target.hp=target.maxHp=500;target.position.copy(g.player.position);target.position.z+=2;target.position.y=g.world.height(target.position.x,target.position.z);g.selectEnemy(target);g.player.yaw=0;
      const started=g.requestAttack('sword');let maxGripError=0,impactPose=null;
      for(let i=0;i<40;i++){
        g.frame(.025);g.avatar.root.updateMatrixWorld(true);
        if(weapon==='weapon.spear'){
          const hand=g.avatar.rig.bones.handL.localToWorld(new Vector3(-SWORD_GRIP.position[0],SWORD_GRIP.position[1],SWORD_GRIP.position[2]));
          const sword=g.avatar.root.getObjectByName('socket.rightPalmGrip').children[0],grip=sword.localToWorld(new Vector3(0,weapon==='weapon.spear'?.24:-.22,0));maxGripError=Math.max(maxGripError,hand.distanceTo(grip));
        }
      }
      g.camera.position.copy(g.player.position).add(new Vector3(3.7,2.7,4.8));g.camera.lookAt(g.player.position.clone().add(new Vector3(0,1.4,0)));g.renderer.render(g.scene,g.camera);
      return {weapon,started,damage:500-target.hp,mounted:g.mounts.mounted,maxGripError,weaponVisible:g.equipment.sword.visible};
    },weapon);
    console.log(result);results.push(result);assert.ok(result.started&&result.damage>0&&result.mounted&&result.weaponVisible);assert.ok(result.maxGripError<.005);
    await page.screenshot({path:`test-results/factions/mounted-${weapon.replaceAll('.','-')}.png`});
  }
  await page.keyboard.down('w');await page.keyboard.down('Shift');
  const movement=await page.evaluate(()=>{const g=gameDemo;g.selectEnemy(null);g.player.position.set(0,g.world.height(0,-55),-55);g.player.yaw=Math.PI;const start=g.player.position.clone();for(let i=0;i<30;i++)g.frame(.05);return {distance:start.distanceTo(g.player.position),mounted:g.mounts.mounted,speed:g.player.speed};});
  await page.keyboard.up('w');await page.keyboard.up('Shift');assert.ok(movement.mounted&&movement.distance>6);
  assert.deepEqual(errors,[]);await writeFile('test-results/factions/mounted-combat.json',JSON.stringify({results,movement,errors},null,2));
}finally{await browser.close();}
