const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const p = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await p.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  await p.waitForTimeout(3000);
  await p.screenshot({ path: '/tmp/final_01.png', fullPage: true });
  console.log('1: Desktop');

  const m = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await m.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  await m.waitForTimeout(3000);
  await m.screenshot({ path: '/tmp/final_02.png', fullPage: true });
  console.log('2: Mobile');

  await browser.close();
  console.log('Done!');
})();
