const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Screenshot 1: Main page with all tabs
  await page.screenshot({ path: '/tmp/final_01_main.png', fullPage: true });
  console.log('Screenshot 1: Main page');

  // Click Bulk Upload tab
  await page.click('text=Bulk Upload');
  await page.waitForTimeout(500);
  await page.screenshot({ path: '/tmp/final_02_bulk_tab.png', fullPage: true });
  console.log('Screenshot 2: Bulk Upload tab');

  // Go back to Single Upload and test with KMRCL
  await page.click('text=Single Upload');
  await page.waitForTimeout(300);
  await page.selectOption('#orgSelect', 'KMRCL');
  const fileInput = await page.$('#fileInput');
  await fileInput.setInputFiles('/Users/shashishekharmishra/Downloads/1775_KMRCL GA Spares Waivedoff Letter.docx');
  await page.waitForTimeout(500);
  await page.click('#extractBtn');
  await page.waitForSelector('#extractedSection:not([style*="display: none"])', { timeout: 120000 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: '/tmp/final_03_kmrcl_extracted.png', fullPage: true });
  console.log('Screenshot 3: KMRCL extracted');

  await browser.close();
  console.log('Done!');
})();
