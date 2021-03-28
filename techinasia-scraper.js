// techinasia scraper
// get job details via API: https://www.techinasia.com/api/2.0/job-postings/<JOB-ID>
// {
//     "avatar": "https://cdn.techinasia.com/data/images/6taLLWf2ONLxcoqIvdifH1YincNDpST7IzJGSjkL.svg",
//     "url": "https://www.techinasia.com/jobs/67008090-f7c7-4372-8ff3-37dfa37b7004/apply",
//     "id": "TIA-----67008090-f7c7-4372-8ff3-37dfa37b7004",
//     "name": "UI/UX Design Lead (Japanese Speaking)",
//     "company": "Snaphunt Pte Ltd",
//     "salary": "SGD 3,500 – 6,000",
//     "tags": [
//         "UX/UI Design",
//         "Human Resource",
//         "Full-time"
//     ],
//     "postedDate": "2020-04-08T16:00:00.000Z",
//     "source": "Tech In Asia"
// },


const fs = require('fs');
const axios = require('axios');
const path = require('path');
const puppeteer = require('puppeteer');

function extractItems() {
  const extractedElements = document.querySelectorAll('article[data-cy="job-result"]');
  const items = [];
  for (let element of extractedElements) {
    const url = element.querySelector('a[data-cy="job-title"]').getAttribute('href')
    let postedDate = element.querySelector('.published-at').innerText.trim()
    if (postedDate.includes('ago')) {
      const hours = postedDate.includes('d ago') ? 
        parseInt(postedDate.split('d ago')[0]) * 24 :
        parseInt(postedDate.split('h ago')[0])
      postedDate = new Date() - hours * 60 * 60 * 1000
    }
    const job = {
      avatar: element.querySelector('.avatar img').src,
      url: 'https://www.techinasia.com' + url + '/apply',
      aggId: 'TIA-----' + url.split('/')[2],
      name: element.querySelector('a[data-cy="job-title"]').innerText,
      company: element.querySelector('a[href^="/companies/"]').innerText,
      salary: element.querySelector('.compensation').innerText,
      tags: Array.from(element.querySelectorAll('ul.additional-meta li')).reduce((arr, el) => [...arr, el.innerText], []),
      postedDate: new Date(postedDate).toISOString(),
      source: 'Tech In Asia'
    }
    items.push(job);
  }
  return items;
}

async function scrapeInfiniteScrollItems(
  page,
  extractItems,
  itemTargetCount,
  scrollDelay = 1000,
) {
  let items = [];
  try {
    let previousHeight;
    while (items.length < itemTargetCount) {
      items = await page.evaluate(extractItems);
      previousHeight = await page.evaluate('document.body.scrollHeight');
      await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
      await page.waitForFunction(`document.body.scrollHeight > ${previousHeight}`);
      await page.waitFor(scrollDelay);
    }
  } catch (e) { }
  return items;
}

async function downloadImages(url) {
  const p = path.resolve(__dirname, 'images', url.split('/').reverse()[0])
  const writer = fs.createWriteStream(p)
  const response = await axios({
    url,
    method: 'GET',
    responseType: 'stream'
  })

  response.data.pipe(writer)

  return new Promise((resolve, reject) => {
    writer.on('finish', async () => {
      if (p.includes('.svg')) {
        const sharp = require('sharp')
        await sharp(p).png().toFile(p.replace('.svg', '.png'))
        resolve(p.replace('.svg', '.png'))
      } else {
        resolve(p)
      }
    })
    writer.on('error', reject)
  })
}

async function reuploadImages(url) {
  try {
    const p = await downloadImages(url)
    const FormData = require('form-data');

    const data = new FormData();
    data.append('image', fs.createReadStream(path.resolve(__dirname, p)))
    const response = await axios.post('https://api.imgur.com/3/image', data, { 
      headers: {
        'Authorization': `Client-ID a51c1927c976c59`,
        ...data.getHeaders()
      },
     })
    return response.data.data.link || url
  } catch (e) {
    console.log('cannot download/upload image: ', url, e)
  }
}

async function parse() {
  // Set up browser and page.
  const args = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--no-first-run',
    '--no-zygote',
    '--single-process',
    '--disable-gpu'
  ]
  const browser = await puppeteer.launch({
    headless: true,
    args,
  });
  const page = await browser.newPage();
  page.setViewport({ width: 1280, height: 926 });

  // Navigate to the demo page.
  await page.goto('https://www.techinasia.com/jobs/search?country_name[]=Singapore', { waitUntil: 'networkidle0', timeout: 0 });

  // Get the number of jobs from the dropdown filter
  const elem = await page.$$('.container .content span.clickable');
  await elem[1].click();
  const count = await page.$eval('div.dropdown a.checked small', el => el.textContent);

  // Scroll and extract items from the page.
  const items = await scrapeInfiniteScrollItems(page, extractItems, count);

  // // Save extracted items to a file.
  fs.writeFileSync('./techinasia-items.json', JSON.stringify(items));

  // const items = [
  //   {
  //       "avatar": "https://cdn.techinasia.com/data/images/6taLLWf2ONLxcoqIvdifH1YincNDpST7IzJGSjkL.svg",
  //       "url": "https://www.techinasia.com/jobs/67008090-f7c7-4372-8ff3-37dfa37b7004/apply",
  //       "aggId": "TIA-----67008090-f7c7-4372-8ff3-37dfa37b7004",
  //       "name": "UI/UX Design Lead (Japanese Speaking)",
  //       "company": "Snaphunt Pte Ltd",
  //       "salary": "SGD 3,500 – 6,000",
  //       "tags": [
  //           "UX/UI Design",
  //           "Human Resource",
  //           "Full-time"
  //       ],
  //       "postedDate": "2020-04-08T16:00:00.000Z",
  //       "source": "Tech In Asia"
  //   }
  // ]

  const uploadedItems = []
  const failedItems = []

  // const items = JSON.parse(fs.readFileSync('./techinasia-uploaded-items.json'))

  for (const item of items) {
    try {
      // Get job first so we don't need to reupload
      let job
      if (item.aggId) {
        try {
          job = await axios.get(`${process.env.TECHJOBS_API}/api/getJob?aggId=${item.aggId}`)
          if (job.data.avatar.includes('imgur')) delete item.avatar
        } catch (e) { }
      }
      if (item.avatar && !item.avatar.includes('imgur')) {
        const newImg = await reuploadImages(item.avatar)
        if (newImg && newImg !== 'undefined') {
          item.avatar = newImg
        }
      }
      const response = await axios.post(`${process.env.TECHJOBS_API}/api/createJob`, item, { headers: { 'Content-Type': 'application/json' } })
      console.log(`Added/updated job with ID: ${response.data.id}`)
      uploadedItems.push(item)
    } catch (e) {
      console.log(e)
      failedItems.push(item)
    }
  }

  fs.writeFileSync('./techinasia-uploaded-items.json', JSON.stringify(uploadedItems));
  fs.writeFileSync('./techinasia-failed-items.json', JSON.stringify(failedItems));

  // Close the browser.
  await browser.close();
}

if (require.main === module) {
  (async () => {
    await parse()
  })();
}


module.exports = {
  parse,
  reuploadImages
}