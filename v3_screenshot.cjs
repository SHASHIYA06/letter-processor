const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });

  // Desktop view
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Extract KMRCL
  await page.selectOption('#orgSelect', 'KMRCL');
  await page.$('#fileInput').then(el => el.setInputFiles('/Users/shashishekharmishra/Downloads/1775_KMRCL GA Spares Waivedoff Letter.docx'));
  await page.waitForTimeout(500);
  await page.click('#extractBtn');
  await page.waitForSelector('#extractedSection:not([style*="display: none"])', { timeout: 120000 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: '/tmp/v3_01_desktop.png', fullPage: true });
  console.log('Screenshot 1: Desktop view');

  // Mobile view
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await mobile.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  await mobile.waitForTimeout(1000);
  await mobile.screenshot({ path: '/tmp/v3_02_mobile.png', fullPage: true });
  console.log('Screenshot 2: Mobile view');

  // Mobile with extraction
  await mobile.selectOption('#orgSelect', 'BEML');
  await mobile.$('#fileInput').then(el => el.setInputFiles('/Users/shashishekharmishra/Downloads/21 Quotation _ BEML_Kolkata_26_27.pdf'));
  await mobile.waitForTimeout(500);
  await mobile.click('#extractBtn');
  await mobile.waitForSelector('#extractedSection:not([style*="display: none"])', { timeout: 120000 });
  await mobile.waitForTimeout(1000);
  await mobile.screenshot({ path: '/tmp/v3_03_mobile_extracted.png', fullPage: true });
  console.log('Screenshot 3: Mobile extracted');

  await browser.close();
  console.log('Done!');
})();
