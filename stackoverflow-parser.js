// {
//     "avatar": "",
//     "url": "https://stackoverflow.com/jobs/320515/information-security-engineer-razer-inc",
//     "aggId": "SO-----320515",
//     "name": "Information Security Engineer",
//     "company": "Razer Inc.",
//     "salary": "",
//     "tags": [
//         "windows",
//         "linux",
//         "amazon-ec2"
//     ],
//     "postedDate": "2020-05-16T06:49:28.000Z",
//     "source": "Stack Overflow",
//     "description": "..."
// }

require('dotenv').config()
const fs = require('fs')
const Parser = require('rss-parser');
const slugify = require('slugify')
const cheerio = require('cheerio');
const axios = require('axios')
const parser = new Parser();

async function parse() {
    let feed = await parser.parseURL('http://stackoverflow.com/jobs/feed?l=Singapore&u=Km&d=50');

    let items = []

    let companies = []

    feed.items.forEach((item, key) => {
        // if (key > 0) return
        const title = item.title.split(' at ')
        const company = title[1].replace(' (Singapore)', '')
        const job = {
            avatar: '',
            url: item.link.split('?')[0],
            aggId: 'SO-----' + item.guid,
            name: title[0],
            company,
            salary: '',
            tags: item.categories,
            postedDate: item.isoDate,
            source: 'Stack Overflow',
            description: item.content
        }
        items.push(job);
        if (!companies.find(c => c.name === company)) {
            companies.push({
                name: company,
                slug: slugify(company, { lower: true, strict: true })
            })
        }
    });

    // Save extracted items to a file.
    fs.writeFileSync('./items.json', JSON.stringify(items));
    await Promise.all(companies.map(async co => {
        const company = await axios.get(`${process.env.TECHJOBS_API}/api/getCompany?name=${co.name}`, {
            validateStatus: function (status) {
                return [200, 404].includes(status); // Resolve only if the status code is less than 500
            }
        })
        if (company.status === 200 && company.data.imgUrl && company.data.tagline && !company.data.url && company.data.companySize) return
        let imgUrl = '', tagline = '', url = '', companySize = ''
        try {
            // Get the company image
            const companyPage = await axios.get(`https://stackoverflow.com/jobs/companies/${co.slug}`, {
                headers: {
                    'Content-Type': 'text/plain'
                }
            })
            const $ = cheerio.load(companyPage.data);
            imgUrl = $('#gh-logo').attr('src')
            tagline = $('#company-name-tagline p').text()
            url = $('a[href^="https://stackoverflow.com/jobs/companies/a/ext-link"]').attr('href')
            companySize = $('p.fs-category:contains("Size")').next().text()
            if (url) {
                url = new URL(url)
                url = url.searchParams.get('redirectUrl')
            }
        } catch (e) { }
        if (company.status === 200) {
            await axios.put(`${process.env.TECHJOBS_API}/api/updateCompany`, { ...company.data, imgUrl: imgUrl || 'https://', tagline, url, companySize })
        } else {
            console.log(co.name)
            console.log(company.status)
            await axios.post(`${process.env.TECHJOBS_API}/api/createCompany`, { name: co.name, imgUrl: imgUrl || 'https://', tagline, url, companySize })
        }
    }))

    await Promise.all(items.map(async item => {
        try {
            const response = await axios.post(`${process.env.TECHJOBS_API}/api/createJob`, item, { headers: { 'Content-Type': 'application/json' } })
            console.log(`Added/updated job with ID: ${response.data.id}`)
        } catch (e) {
            console.log(e)
        }
    }))
}

(async () => {
    await parse()
})();

module.exports = {
    parse
}