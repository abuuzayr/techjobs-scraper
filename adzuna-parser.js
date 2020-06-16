// {
//     "avatar": "",
//     "url": "https://www.adzuna.sg/land/ad/1451392220?se=-BjnHgSo6hGRAMrMaBNdWg&v=AADEE118EB7D0BB8EA26594108492DD795EE0557",
//     "aggId": "ADZ-----1451392220",
//     "name": "Webmaster - MNC Bank",
//     "company": "Charterhouse Partnership Singapore, EA Licence No: 16S8066",
//     "salary": "",
//     "tags": [],
//     "postedDate": "2020-02-15T00:00:00.000Z",
//     "source": "eFinancialCareers,Adzuna"
// }

require('dotenv').config()
const fs = require('fs')
const axios = require('axios')

axios.defaults.timeout = 5000;
// axios.defaults.proxy = {
//     host: '1.10.189.107',
//     port: 33376,
// }

const getJobs = async (url, count) => {
    try {
        const response = await axios.get(url)
        if (response) {
            count = response.data.count
            for (let i = 0; i < response.data.results.length; i++) {
                await parseToPost(response.data.results[i])
            }
            // response.data.results.forEach(result => parseToPost(result));
        }
        return count
    } catch (e) {
        console.log(e);
    }
}

const parseToPost = async item => {
    try {
        let salary = '',
            min = item.salary_min ? new Intl.NumberFormat('en-SG', { style: 'currency', currency: 'SGD' }).format(item.salary_min).split('.')[0] : '',
            max = item.salary_max ? new Intl.NumberFormat('en-SG', { style: 'currency', currency: 'SGD' }).format(item.salary_max).split('.')[0] : ''
        if (min && max) {
            if (min !== max) {
                salary = `${min} - ${max}`
            } else {
                salary = `${min}`
            }
        } else if (min || max) {
            salary = `${min || max}`
        }
        const job = {
            avatar: '',
            url: item.redirect_url.replace('&utm_medium=api&utm_source=cbd5e3be', ''),
            aggId: 'ADZ-----' + item.id,
            name: item.title,
            company: item.company.display_name,
            salary,
            tags: [],
            postedDate: item.created.split('T')[0] + 'T00:00:00.000Z',
            source: 'Adzuna'
        }
        let companyAbout = ''
        if (job.url) {
            try {
                const response = await axios.get(job.url, {
                    headers: {
                        'Content-Type': 'text/plain'
                    }
                })
                if (response) {
                    const source = response.data.split('You are now being redirected to <strong>')[1].split('</strong>')[0]
                    if (source) job.source = source + `,${job.source}`
                    if (source === 'eFinancialCareers') {
                        console.log('getting EFC data for ', job.aggId, '...')
                        const getEFCData = require('./efinancialcareers-scraper').getEFCData
                        const additional = await getEFCData(job.url)
                        job.avatar = additional.image
                        job.description = additional.about
                        companyAbout = additional.companyAbout
                    }
                }
            } catch (e) {
                console.log(e)
            }
        }
        // fs.writeFileSync('./items.json', JSON.stringify(job));
        const response = await axios.post(`${process.env.TECHJOBS_API}/api/createJob`, job, { headers: { 'Content-Type': 'application/json' } })
        console.log(`Added/updated job with ID: ${response.data.id}`)
        if (companyAbout && job.company) {
            try {
                const company = await axios.get(`${process.env.TECHJOBS_API}/api/getCompany?name=${job.company}`, {
                    validateStatus: function (status) {
                        return [200, 404].includes(status); // Resolve only if the status code is less than 500
                    }
                })
                if (company.status === 200 && company.data.about) return
                if (company.status === 200) {
                    await axios.put(`${process.env.TECHJOBS_API}/api/updateCompany`, { ...company.data, about: companyAbout })
                }
                console.log('updated ', job.company)
            } catch (e) {
                console.log('unable to update ', job.company)
            }
        }
    } catch (e) {
        console.log(e)
    }
}

async function parse () {
    const urls = [
        'https://api.adzuna.com/v1/api/jobs/sg/search/1?app_id=cbd5e3be&app_key=1e1a32f997d8d1a1145207a17a775aca&results_per_page=715&full_time=1&content-type=application/json&category=it-jobs',
        'https://api.adzuna.com/v1/api/jobs/sg/search/1?app_id=cbd5e3be&app_key=1e1a32f997d8d1a1145207a17a775aca&results_per_page=715&permanent=1&content-type=application/json&category=it-jobs'
    ]

    let page = 0
    let count = 1
    const itemsPerPage = 50

    while ((page * itemsPerPage) < count) {
        page++
        try {
            console.log("count: ", count)
            count = await getJobs(`http://api.adzuna.com/v1/api/jobs/sg/search/${page}?app_id=cbd5e3be&app_key=1e1a32f997d8d1a1145207a17a775aca&results_per_page=${itemsPerPage}&full_time=1&content-type=application/json&category=it-jobs`, count)
        } catch (e) {
            console.log(e)
        }
        // break
    }
}

(async () => {
    await parse()
})();

module.exports = {
    parse
}