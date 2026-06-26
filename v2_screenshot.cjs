const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Test 1: KMRCL with auto-detect
  await page.selectOption('#orgSelect', 'KMRCL');
  const fileInput = await page.$('#fileInput');
  await fileInput.setInputFiles('/Users/shashishekharmishra/Downloads/1775_KMRCL GA Spares Waivedoff Letter.docx');
  await page.waitForTimeout(500);
  await page.click('#extractBtn');
  await page.waitForSelector('#extractedSection:not([style*="display: none"])', { timeout: 120000 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: '/tmp/v2_01_kmrcl.png', fullPage: true });
  console.log('Screenshot 1: KMRCL extracted');

  // Save the record
  await page.click('#saveBtn');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: '/tmp/v2_02_saved.png', fullPage: true });
  console.log('Screenshot 2: Record saved');

  // Test 2: BEML Quotation
  await page.selectOption('#orgSelect', 'BEML');
  await fileInput.setInputFiles('/Users/shashishekharmishra/Downloads/21 Quotation _ BEML_Kolkata_26_27.pdf');
  await page.waitForTimeout(500);
  await page.click('#extractBtn');
  await page.waitForSelector('#extractedSection:not([style*="display: none"])', { timeout: 120000 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: '/tmp/v2_03_beml_quotation.png', fullPage: true });
  console.log('Screenshot 3: BEML Quotation');

  // Test 3: Bulk Upload tab
  await page.click('text=Bulk Upload');
  await page.waitForTimeout(500);
  await page.screenshot({ path: '/tmp/v2_04_bulk.png', fullPage: true });
  console.log('Screenshot 4: Bulk Upload');

  await browser.close();
  console.log('Done!');
})();
