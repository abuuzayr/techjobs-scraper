// linkedin scraper

const fs = require('fs');
const puppeteer = require('puppeteer');

async function extractItems() {
  const items = {}

  items.employeeCount = document.querySelector('a[data-tracking-control-name="org-employees_cta"]').innerText

  return items
}

(async () => {
  // Set up browser and page.
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  page.setViewport({ width: 1280, height: 926 });
  page.setUserAgent('wv, Mozilla/5.0 (Linux; U; Android 4.0.2; en-us; Galaxy Nexus Build/ICL53F) AppleWebKit/534.30 (KHTML, like Gecko) Version/4.0 Mobile Safari/534.30')

  // Navigate to the demo page.
  await page.goto('https://www.linkedin.com/company/propertyguru', { waitUntil: 'networkidle0' });

  // Get the number of jobs from the dropdown filter
  // const count = await page.$eval('#totalJobCount', el => el.textContent);

  // Extract items from the page.
  const items = await page.evaluate(extractItems);

  // Save extracted items to a file.
  fs.writeFileSync('./items.json', JSON.stringify(items));

  // Close the browser.
  await browser.close();
})();