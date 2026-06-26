const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  // Go to the app
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Screenshot 1: Initial state
  await page.screenshot({ path: '/tmp/01_initial.png', fullPage: true });
  console.log('Screenshot 1: Initial state');

  // Select organization
  await page.selectOption('#orgSelect', 'KMRCL');
  await page.waitForTimeout(300);

  // Upload file
  const filePath = '/Users/shashishekharmishra/Downloads/1775_KMRCL GA Spares Waivedoff Letter.docx';
  const fileInput = await page.$('#fileInput');
  await fileInput.setInputFiles(filePath);
  await page.waitForTimeout(500);

  // Screenshot 2: File selected
  await page.screenshot({ path: '/tmp/02_file_selected.png', fullPage: true });
  console.log('Screenshot 2: File selected');

  // Click OCR & Extract
  await page.click('#extractBtn');

  // Wait for extraction to complete (up to 60 seconds)
  await page.waitForSelector('#extractedSection:not([style*="display: none"])', { timeout: 120000 });
  await page.waitForTimeout(1000);

  // Screenshot 3: Extracted data (auto-filled)
  await page.screenshot({ path: '/tmp/03_extracted_data.png', fullPage: true });
  console.log('Screenshot 3: Extracted data with auto-fill');

  await browser.close();
  console.log('Done!');
})();
