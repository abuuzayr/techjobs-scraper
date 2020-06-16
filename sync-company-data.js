require('dotenv').config()

async function sync() {
    try {
        const base = require('airtable').base('appjZBRulMFmg0cOi');
        const axios = require('axios')
        // Get companies from DB and push to airtable if not there

        let companiesInDB = await axios(process.env.TECHJOBS_API + '/api/getCompanies')
        companiesInDB = companiesInDB.data

        // Pull company data from airtable 

        const companiesInAT = []
        await base('companies').select().eachPage((records, fetchNextPage) => {
            records.forEach(function (record) {
                companiesInAT.push({
                    ...record.fields,
                    airtableId: record.id
                })
            });
            fetchNextPage();
        })

        // Override table data with DB data if table data is empty
        // Except for some fields, which are primarily filled from AT

        const newCompanies = []

        companiesInDB.forEach(company => {
            const companyInAT = companiesInAT.find(c => c.name === company.name)
            if (companyInAT) {
                const ignoreKeys = ['liUrl', 'gdUrl']
                Object.keys(company).forEach(key => {
                    if (ignoreKeys.includes(key)) return
                    if (!companyInAT[key] && company[key]) {
                        console.log('replacing airtable data with db data: ', key)
                        companyInAT[key] = company[key]
                    }
                })
            } else {
                newCompanies.push(company)
            }
        })

        // Update db with company data

        await Promise.all(companiesInAT.map(async company => {
            try {
                const data = { ...company }
                delete data.airtableId
                delete data.liLastUpdated
                delete data.gdLastUpdated
                if (data.gdRating) data.gdRating = data.gdRating.toString()
                await axios.put(`${process.env.TECHJOBS_API}/api/updateCompany`, data)
            } catch (e) {
                console.log(company)
            }
        }))

        const UPDATE_ROUNDS = Math.ceil(companiesInAT.length / 10)

        for (let i = 0; i < UPDATE_ROUNDS; i++) {
            setTimeout(async () => {
                try {
                    const start = i * 10
                    const toUpdate = companiesInAT.slice(start, start + 10)
                    await base('companies').update(toUpdate.map(company => {
                        const c = { ...company }
                        const id = c.airtableId
                        delete c.airtableId
                        delete c.id
                        return {
                            id,
                            fields: c
                        }
                    }))
                } catch (e) {
                    console.log(e)
                }
            }, i * 1000)
        }

        // Push all data to table

        const CREATE_ROUNDS = Math.ceil(newCompanies.length / 10)

        for (let i = 0; i < CREATE_ROUNDS; i++) {
            setTimeout(async () => {
                try {
                    const start = i * 10
                    const toAdd = newCompanies.slice(start, start + 10)
                    await base('companies').create(toAdd.map(company => {
                        const c = { ...company }
                        delete c.id
                        return {
                            fields: c
                        }
                    }))
                } catch (e) {
                    console.log(e)
                }
            }, i * 1000)
        }

        // Sync data from LinkedIn scraper

        const companiesWithLinkedIn = [...companiesInAT, ...newCompanies].filter(c => !!c.liUrl)

        for (const co of companiesWithLinkedIn) {
            try {
                if (new Date() - new Date(co.liLastUpdated) < (7 * 24 * 60 * 60 * 1000)) continue
                const company = { ...co }
                const scraper = require('./linkedin-company-scraper').getCompanyOrPeopleDetails
                const data = await scraper(company.liUrl)
                if (!data) continue
                if (!company.tagline) company.tagline = data.tagline
                if (!company.about) company.about = data.description
                if (!company.url) company.url = data.website
                if (!company.liEmpCount) company.liEmpCount = data.membersOnLinkedin
                if (!company.foundedYear) company.foundedYear = data.foundedYear
                if (!company.companySize) company.companySize = data.companySize
                const id = company.airtableId
                delete company.airtableId
                delete company.id
                await base('companies').update([{
                    id,
                    fields: {
                        ...company,
                        liLastUpdated: new Date()
                    }
                }])
            } catch (e) {
                console.log(e)
            }
        }

        // Sync data from Glassdoor scraper

        const companiesWithGlassdoor = [...companiesInAT, ...newCompanies].filter(c => !!c.gdUrl)

        for (const co of companiesWithGlassdoor) {
            try {
                if (new Date() - new Date(co.gdLastUpdated) < (7 * 24 * 60 * 60 * 1000)) continue
                const company = { ...co }
                const scraper = require('./glassdoor-scraper').getGlassdoorData
                const data = await scraper(company.gdUrl)
                if (!data) continue
                if (!company.gdRating) company.gdRating = parseFloat(data.rating)
                if (!company.gdReviewCount) company.gdReviewCount = parseInt(data.reviewCount)
                const id = company.airtableId
                delete company.airtableId
                delete company.id
                await base('companies').update([{
                    id,
                    fields: {
                        ...company,
                        gdLastUpdated: new Date()
                    }
                }])
            } catch (e) {
                console.log(e)
            }
        }

    } catch (e) {
        console.log(e)
    }
}

(async () => {
    await sync()
})();

module.exports = {
    sync
}