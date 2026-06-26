const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const p = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await p.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  await p.waitForTimeout(2000);
  await p.screenshot({ path: '/tmp/v4_01_main.png', fullPage: true });
  console.log('1: Main');

  // NCR tab
  await p.evaluate(() => { document.querySelectorAll('.tab')[2].click(); });
  await p.waitForTimeout(500);
  await p.screenshot({ path: '/tmp/v4_03_ncr.png', fullPage: true });
  console.log('2: NCR');

  // Joint Note tab
  await p.evaluate(() => { document.querySelectorAll('.tab')[3].click(); });
  await p.waitForTimeout(500);
  await p.screenshot({ path: '/tmp/v4_04_joint.png', fullPage: true });
  console.log('3: Joint Note');

  // Mobile
  const m = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await m.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  await m.waitForTimeout(2000);
  await m.screenshot({ path: '/tmp/v4_05_mobile.png', fullPage: true });
  console.log('4: Mobile');

  await browser.close();
  console.log('Done!');
})();
