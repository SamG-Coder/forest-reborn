import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const errors=[];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://127.0.0.1:5173/body.html');
  await page.waitForFunction(() => window.bodyPreview?.ready);
  for (const view of ['front','front-quarter','rear-quarter','left','top','hand','shoulders','hips']) {
    for (const mode of ['clay','wire']) {
      const data=await page.evaluate(({view,mode})=>window.bodyPreview.capture(view,mode,'simplified'),{view,mode});
      await writeFile(`public/validation/body/simplified-${view}-${mode}.png`,Buffer.from(data.split(',')[1],'base64'));
    }
  }
  await page.selectOption('#variant','simplified');
  await page.selectOption('#view','front-quarter');
  await page.selectOption('#surface','wire');
  await page.screenshot({path:'test-results/simplified-wire-preview.png'});
  if(errors.length) throw new Error(errors.join('\n'));
  console.log('Simplified mesh: all inspection views rendered; no browser errors.');
} finally { await browser.close(); }
