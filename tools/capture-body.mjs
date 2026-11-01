import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const output = new URL('../public/validation/body/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1050 } });
  page.on('pageerror', error => { throw error; });
  await page.goto('http://127.0.0.1:5173/body.html');
  await page.waitForFunction(() => window.bodyPreview?.ready);
  for (const variant of ['depth', 'baseline']) {
    for (const view of ['front', 'back', 'left', 'top', 'front-quarter', 'rear-quarter', 'hand', 'shoulders', 'bottom']) {
      for (const mode of ['mask', 'texture', 'clay']) {
        const url = await page.evaluate(({view, mode, variant}) => window.bodyPreview.capture(view, mode, variant), {view, mode, variant});
        await writeFile(new URL(`${variant}-${view}-${mode}.png`, output), Buffer.from(url.split(',')[1], 'base64'));
      }
    }
  }
  await page.selectOption('#surface', 'clay');
  await page.selectOption('#variant', 'depth');
  await page.selectOption('#view', 'orbit');
  await page.screenshot({ path: 'test-results/body-preview.png' });
} finally { await browser.close(); }
