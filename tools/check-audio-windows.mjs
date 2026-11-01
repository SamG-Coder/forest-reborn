import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
await mkdir('test-results/ui',{recursive:true});
const browser=await chromium.launch({args:['--enable-gpu','--use-angle=d3d11']});
try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto('http://127.0.0.1:5173/');await page.locator('#new-save').click();await page.waitForFunction(()=>window.gameDemo?.ready,null,{timeout:120000});
  await page.evaluate(()=>{const g=gameDemo;g.renderer.setAnimationLoop(null);g.voices.setMuted(true);g.enter();g.opening.finish();g.frame(.016);g.playerPanels.show('bag');});
  const audio=await page.evaluate(async()=>{
    const {GameAudio}=await import('/src/audio/mixer.js'),PerspectiveCamera=gameDemo.camera.constructor,Vector3=gameDemo.player.position.constructor;
    async function render(x,z,rotate=false,mute=false){
      const ctx=new OfflineAudioContext(2,24000,24000),mix=new GameAudio(()=>ctx),cam=new PerspectiveCamera();if(rotate)cam.rotation.y=Math.PI;
      mix.update(new Vector3(),cam);if(mute)mix.setMuted(true);
      const spatial=mix.spatialInput(new Vector3(x,1.5,z)),source=ctx.createBufferSource(),buffer=ctx.createBuffer(1,10000,24000),data=buffer.getChannelData(0);
      for(let i=0;i<data.length;i++)data[i]=Math.sin(2*Math.PI*440*i/24000)*.3;
      source.buffer=buffer;source.connect(spatial.input);source.start(.3);const out=await ctx.startRendering();
      return [...Array(2)].map((_,channel)=>{const d=out.getChannelData(channel);let power=0;for(let i=8000;i<16000;i++)power+=d[i]*d[i];return Math.sqrt(power/8000);});
    }
    const left=await render(-4,-4),right=await render(4,-4),far=await render(18,-18),reversed=await render(-4,-4,true),muted=await render(-4,-4,false,true);
    const g=gameDemo;g.gameAudio.update(g.player.position,g.camera);let accepted=0;for(let i=0;i<80;i++)accepted+=g.gameAudio.play('metal',g.player.position,{id:'stress-'+i,priority:true})?1:0;
    return {left,right,far,reversed,muted,accepted,active:g.gameAudio.playing.size};
  });
  assert.ok(audio.left[0]>audio.left[1]*1.3);assert.ok(audio.right[1]>audio.right[0]*1.3);assert.ok(audio.reversed[1]>audio.reversed[0]*1.3);
  assert.ok(audio.far[0]+audio.far[1]<(audio.right[0]+audio.right[1])*.4);assert.ok(Math.max(...audio.muted)<.0001);assert.ok(audio.active<=32);
  // Every major in-game window adopts the same chrome and keeps the bag open.
  const panels=[];
  async function capture(name,open,selector){
    await page.evaluate(open);await page.waitForTimeout(80);await page.mouse.move(1405,970);await page.evaluate(()=>gameDemo.frame(.016));
    const panel=page.locator(selector).first();await panel.waitFor({state:'visible'});assert.ok(await panel.locator('.window-titlebar').count());
    const bounds=await panel.boundingBox();assert.ok(bounds.width<=920);assert.ok(await page.locator('.bag-window').isVisible());
    panels.push({name,...bounds});console.log('Checked window:',name);await page.screenshot({path:`test-results/ui/${name}.png`});
  }
  await capture('quests',()=>gameDemo.worldUI.quests(),'.world-panel[data-kind="quests"]');
  await capture('trader',()=>{const g=gameDemo,p=g.population.residents.find(p=>p.id==='trader');g.player.position.copy(p.position);g.player.position.x+=1;g.worldUI.talk(p,'buy');},'.world-panel[data-kind="npc"]');
  const header=page.locator('.world-panel[data-kind="npc"] .window-titlebar'),before=await header.boundingBox();
  await page.mouse.move(before.x+100,before.y+20);await page.mouse.down();await page.mouse.move(before.x+160,before.y+50,{steps:6});await page.mouse.up();const after=await header.boundingBox();assert.ok(after.x>before.x+40);
  await capture('crafting',()=>{const g=gameDemo,s=g.world.workstations.stations.find(s=>s.id==='carpenter');g.player.position.copy(s.position);g.worldUI.workstation(s);},'.world-panel[data-kind="workshop"]');
  await capture('guilds',()=>gameDemo.societyPanel.show(),'.society-panel');
  await capture('factions',()=>gameDemo.factionPanel.show(),'.faction-panel');
  await capture('friends',()=>gameDemo.worldUI.friends(),'.world-panel:not(.society-panel):not(.faction-panel):not(.journey-panel):not(.loot-panel):not([hidden])');
  await capture('skills',()=>gameDemo.playerPanels.show('skills'),'.character-window');
  await capture('map',()=>gameDemo.worldUI.map(),'.world-panel[data-kind="map"]');
  await capture('journey',()=>document.querySelector('#journey-button').click(),'.journey-panel');
  await capture('camera',()=>document.querySelector('#camera-options').click(),'.camera-settings');
  await page.keyboard.press('Escape');assert.ok(await page.locator('.camera-settings').isHidden());assert.ok(await page.locator('.bag-window').isVisible());
  for(const [key,selector]of [['c','.character-window'],['k','.character-window'],['l','.world-panel[data-kind="quests"]'],['o','.world-panel[data-kind="friends"]'],['m','.world-panel[data-kind="map"]'],['g','.society-panel']]){
    await page.keyboard.press(key);assert.ok(await page.locator(selector).first().isVisible(),'Open using '+key);
    await page.keyboard.press(key);assert.ok(await page.locator(selector).first().isHidden(),'Close using '+key);
  }
  for(const selector of ['#journey-button','#camera-options','.top-actions button:has-text("Factions")']){
    await page.locator(selector).click();
    // A movable panel may cover its launch button; move it before toggling again.
    const title=page.locator('.mmo-window.window-focused .window-titlebar'),rect=await title.boundingBox();
    await page.mouse.move(rect.x+150,rect.y+20);await page.mouse.down();await page.mouse.move(1050,260,{steps:5});await page.mouse.up();
    await page.locator(selector).click();
    assert.equal(await page.locator('.world-panel:not([hidden]),.camera-settings:not([hidden])').count(),0);
  }
  await page.evaluate(()=>gameDemo.playerPanels.show('character'));await page.waitForTimeout(100);
  await page.locator('.bag-window h2').click();await page.keyboard.press('Escape');
  assert.ok(await page.locator('.bag-window').isHidden());assert.ok(await page.locator('.character-window').isVisible());
  await page.keyboard.press('Escape');assert.ok(await page.locator('.character-window').isHidden());
  await page.setViewportSize({width:1024,height:768});
  await capture('small-character',()=>{gameDemo.playerPanels.show('bag');gameDemo.playerPanels.show('character');},'.character-window');
  const small=await page.locator('.character-window').boundingBox();assert.ok(small.y+small.height<=650);
  await page.setViewportSize({width:1440,height:1000});
  await page.evaluate(()=>gameDemo.gameMenu.open());await page.locator('.audio-settings summary').click();await page.locator('#audio-effects').evaluate(input=>{input.value='42';input.dispatchEvent(new Event('input',{bubbles:true}));});
  assert.equal(await page.evaluate(()=>gameDemo.gameAudio.settings.effects),.42);await page.mouse.move(1400,980);await page.screenshot({path:'test-results/ui/audio-settings.png'});
  await page.evaluate(()=>gameDemo.gameMenu.close());assert.equal(await page.evaluate(()=>gameDemo.gameAudio.paused),false);
  assert.deepEqual(errors,[]);console.log({audio,panels,errors});await writeFile('test-results/ui/audio-windows.json',JSON.stringify({audio,panels,errors},null,2));
}finally{await browser.close();}
