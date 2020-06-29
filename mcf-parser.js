// {
//     "avatar": null,
//     "url": "https://www.mycareersfuture.sg/job/information-technology/security-software-developer-a6c10e851e471b3061cc0cbf4e58a799",
//     "aggId": "MCF-----a6c10e851e471b3061cc0cbf4e58a799",
//     "name": "Security Software Developer",
//     "company": "GOVERNMENT TECHNOLOGY AGENCY",
//     "salary": "SGD 5,000 - SGD 8,000",
//     "tags": [
//         ".NET",
//         "Agile Methodologies",
//         "C",
//         "C#",
//         "C++",
//         "CSS",
//         "HTML",
//         "Java",
//         "JavaScript",
//         "jQuery",
//         "Linux",
//         "Microsoft SQL Server",
//         "MySQL",
//         "PHP",
//         "Python",
//         "Software Development",
//         "Software Engineering",
//         "SQL",
//         "Web Services",
//         "XML"
//     ],
//     "postedDate": "2020-01-14T03:52:17.000Z",
//     "source": "myCareersFuture"
// }

require('dotenv').config({ path: __dirname + '/.env' })
const fs = require('fs')
const axios = require('axios')
const items = []

const parseToPost = async (item) => {
    try {
        let salary = '',
            min = item.salary.minimum ? new Intl.NumberFormat('en-SG', { style: 'currency', currency: 'SGD' }).format(item.salary.minimum).split('.')[0] : '',
            max = item.salary.maximum ? new Intl.NumberFormat('en-SG', { style: 'currency', currency: 'SGD' }).format(item.salary.maximum).split('.')[0] : ''
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
            avatar: item.postedCompany.logoUploadPath,
            url: item.metadata.jobDetailsUrl,
            aggId: 'MCF-----' + item.uuid,
            name: item.title,
            company: item.postedCompany.name,
            salary,
            tags: item.skills.map(skill => skill.skill),
            postedDate: item.metadata.createdAt,
            source: 'myCareersFuture',
            description: item.description
        }
        const response = await axios.post(`${process.env.TECHJOBS_API}/api/createJob`, job, { headers: { 'Content-Type': 'application/json' } })
        console.log(`Added/updated job with ID: ${response.data.id}`)
        if (item.postedCompany.name && item.postedCompany.description) {
            try {
                const company = await axios.get(`${process.env.TECHJOBS_API}/api/getCompany?name=${item.postedCompany.name}`, {
                    validateStatus: function (status) {
                        return [200, 404].includes(status); // Resolve only if the status code is less than 500
                    }
                })
                if (company.status === 200 && company.data.about) return
                if (company.status === 200) {
                    const data = { ...company.data }
                    if (item.postedCompany.description) data['about'] = item.postedCompany.description
                    if (item.postedCompany.companyUrl) data['url'] = item.postedCompany.companyUrl
                    if (item.postedCompany.employeeCount) data['companySize'] = item.postedCompany.employeeCount + " employees"
                    if (item.postedCompany.uen) data['foundedYear'] = parseInt(item.postedCompany.uen.slice(0, 4))
                    await axios.put(`${process.env.TECHJOBS_API}/api/updateCompany`, data)
                }
                console.log('updated ', job.company)
            } catch (e) {
                console.log(e)
                console.log('unable to update ', job.company)
            }
        }
        items.push(job)
    } catch (e) {
        console.log(e)
    }
}

async function parse(proxy) {
    const urls = [
        'https://api1.mycareersfuture.sg/v2/jobs?employmentTypes=Permanent&limit=100&omitCountWithSchemes=true&page=0&search=Software%20Developer&sortBy=new_posting_date&salary=0',
        'https://api1.mycareersfuture.sg/v2/jobs?employmentTypes=Full%20Time&limit=100&omitCountWithSchemes=true&page=0&search=Software%20Developer&sortBy=new_posting_date&salary=0'
    ]

    let allAggIds = await axios.get(`${process.env.TECHJOBS_API}/api/getAllJobs`)
    if (allAggIds) {
        allAggIds = allAggIds.data.filter(job => job.aggId && job.aggId.includes('MCF-----')).map(job => job.aggId.replace('MCF-----', ''))
    } else {
        console.log("cannot get current IDs")
        return
    }

    for (let url of urls) {
        while (true) {
            try {
                const response = await axios.get(url)
                const results = response.data.results.filter(job => !allAggIds.includes(job.uuid))
                console.log(results.length)
                for (let i = 0; i < results.length; i++) {
                    await parseToPost(results[i], proxy)
                }
                url = response.data._links.next && response.data._links.next.href
                if (!url) break
            } catch (e) {
                console.log(e)
            }
        }
        // fs.writeFileSync('./mcf-items.json', JSON.stringify(items));
    }
    return
}

(async () => {
    await parse()
})();

module.exports = {
    parse
}