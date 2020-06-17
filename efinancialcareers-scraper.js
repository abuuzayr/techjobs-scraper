const fs = require('fs');
const puppeteer = require('puppeteer');
const getProxy = require('./get-proxies').getProxy

async function extractItems() {
  const imgEl = document.querySelector('span.d-flex img[src*="http"]')
  const job = {
    image: imgEl ? imgEl.getAttribute('src') : '',
    about: document.querySelector('.jobContentFrame').innerHTML,
  }
  const aboutElem = [...document.querySelectorAll('.font-weight-bold')].find(element => element.textContent === 'Company Overview')
  if (aboutElem) {
    job.companyAbout = aboutElem.parentElement.innerHTML
  }
  return job
  return new Promise((resolve, reject) => {
    const cardExists = setInterval(() => {
      if (document.querySelectorAll('span.d-flex img[src*="http"]').length) {
        clearInterval(cardExists)
        resolve(job)
      }
    }, 500);
  })
}

async function getEFCData(url) {
  // Set up browser and page.
  const [proxy_host, proxy_port] = getProxy()
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', `--proxy-server=http://${proxy_host}:${proxy_port}`],
  });
  const page = await browser.newPage();
  page.setViewport({ width: 1280, height: 926 });

  // Navigate to the demo page.
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 180000 });

  await page.waitForSelector('#jobTitleStickyTopDiv', { visible: true, timeout: 180000 });

  // // Get the number of jobs from the dropdown filter
  // const count = await page.$eval('#totalJobCount', el => el.textContent);

  // await page.goto(`https://www.efinancialcareers.sg/search/?location=Singapore&latitude=1.352083&longitude=103.819836&countryCode=SG&locationPrecision=Country&radius=40&radiusUnit=km&page=1&pageSize=${count}&filters.sectors=INFORMATION_TECHNOLOGY&filters.positionType=PERMANENT&filters.employmentType=FULL_TIME&currencyCode=SGD&language=en`, { waitUntil: 'networkidle0' });

  // Extract items from the page.
  const items = await page.evaluate(extractItems);

  // Save extracted items to a file.
  // fs.writeFileSync('./items.json', JSON.stringify(items));

  // Close the browser.
  await browser.close();

  return items
}

module.exports = {
  getEFCData
};

// (async () => {
//   const items = await getEFCData("https://www.adzuna.sg/land/ad/1572217358?se=7O4fjWWt6hGs0IjIVp9PKA&v=D5B4515CDD41881F0268F18FF179149021D7CCD2")
//   console.log(items)
// })();