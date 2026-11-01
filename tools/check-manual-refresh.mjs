import {chromium} from '@playwright/test';
import {writeFile,unlink} from 'node:fs/promises';
import assert from 'node:assert/strict';
const path='src/hmr-probe.js';
await writeFile(path,'export const revision=1;');
const browser=await chromium.launch();
try{
  const page=await browser.newPage();let navigations=0;page.on('framenavigated',frame=>{if(frame===page.mainFrame())navigations++;});
  await page.goto('http://127.0.0.1:5173/models/speech/nano08/config.json');
  await page.evaluate(async()=>{window.probeState='retained';await import('/@vite/client');await import('/src/hmr-probe.js');});
  await writeFile(path,'export const revision=2;');await page.waitForTimeout(1600);
  assert.equal(await page.evaluate(()=>window.probeState),'retained');assert.equal(navigations,1);
  const updated=await page.evaluate(async()=>await (await fetch('/src/hmr-probe.js',{cache:'no-store'})).text());assert.match(updated,/revision\s*=\s*2/);
  await writeFile('test-results/manual-refresh.json',JSON.stringify({navigations,sessionRetained:true,freshSourceAvailable:true},null,2));
  console.log('Source changed and cache invalidated without browser navigation.');
}finally{await browser.close();await unlink(path);}
