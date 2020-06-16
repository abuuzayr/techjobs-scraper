// glassdoor scraper

const fs = require('fs');
const puppeteer = require('puppeteer');

async function extractItems() {
  const items = {}

  items.rating = document.querySelector('.v2__EIReviewsRatingsStylesV2__ratingNum').innerText
  items.reviewCount = document.querySelector('.eiCell.cell.reviews .num').innerText.trim()

  return items
}

async function getGlassdoorData(url) {
  // Set up browser and page.
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  page.setViewport({ width: 1280, height: 926 });

  // Navigate to the demo page.
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 0 });

  if (!url.includes('Overview')) {
    const reviewsHref = await page.$eval('.cell.reviews', el => el.href);
    await page.goto(reviewsHref, { waitUntil: 'networkidle0', timeout: 0 });
  }

  // Get the number of jobs from the dropdown filter
  // const count = await page.$eval('#totalJobCount', el => el.textContent);

  // Extract items from the page.
  const items = await page.evaluate(extractItems);

  // Save extracted items to a file.
  // fs.writeFileSync('./items.json', JSON.stringify(items));

  // Close the browser.
  await browser.close();

  return items
}

module.exports = {
  getGlassdoorData
};

(async () => {
  const items = await getGlassdoorData('https://www.glassdoor.sg/facebook');
  console.log(items);
})();