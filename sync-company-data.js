require('dotenv').config({ path: __dirname + '/.env' })
const axios = require('axios')

async function getList(url) {
    try {
        const response = await axios({
            method: "GET",
            url,
            headers: {
                Authorization: `Token ${process.env.BASEROW_API_KEY}`
            }
        })
        return response
    } catch (e) {
        console.log("ERROR!: ", e)
        return false
    }
}

function convertToDBSchema(dataMap, data, withId) {
    return Object.keys(data).reduce((obj, curr) => {
        if (curr === 'id' && withId) {
            obj["id"] = data[curr]
            return obj
        }
        if (!dataMap[curr]) return obj
        let value = data[curr]
        const intFields = ['field_67938', 'field_67917', 'field_67944']
        if (intFields.includes(curr)) {
            value = parseInt(value)
            if (isNaN(value)) value = 0
        }
        obj[dataMap[curr]] = value
        return obj
    }, {})
}

function convertToBaserowSchema(dataMap, data) {
    return Object.keys(data).reduce((obj, curr) => {
        const brKey = Object.entries(dataMap).find(entry => entry[1] === curr)
        if (!brKey) return obj
        obj[brKey[0]] = data[curr]
        return obj
    }, {})
}

async function sync() {
    const dataMap = {
        "field_67896": "name",
        "field_67916": "liUrl",
        "field_67917": "liEmpCount",
        "field_67918": "gdUrl",
        "field_67919": "gdRating",
        "field_67938": "gdReviewCount",
        "field_67939": "about",
        "field_67940": "url",
        "field_67941": "imgUrl",
        "field_67942": "tagline",
        "field_67943": "companySize",
        "field_67944": "foundedYear",
        "field_67945": "gdLastUpdated",
        "field_67946": "liLastUpdated",
    }
    try {
        // Get companies from DB and push to baserow if not there

        let companiesInDB = await axios(process.env.TECHJOBS_API + '/api/getCompanies')
        companiesInDB = companiesInDB.data

        // Pull company data from baserow 

        let companiesInBaserow = []
        let listUrl = "https://api.baserow.io/api/database/rows/table/14835/"
        while(true) {
            try {
                let results = await getList(listUrl)
                if (results) {
                    if (results.data.results) {
                        companiesInBaserow = [ ...companiesInBaserow, ...results.data.results ]
                    }
                    listUrl = results.data.next
                    if (!listUrl) break
                } else {
                    break
                }                
            } catch (e) {
                console.log("ERROR!: ", e)
                break
            }
        }

        // Override table data with DB data if table data is empty
        // Except for some fields, which are primarily filled from baserow

        const newCompanies = []

        companiesInDB.forEach(company => {
            const companyInBaserow = companiesInBaserow.find(c => c["field_67896"] === company.name.trim())
            if (companyInBaserow) {
                const ignoreKeys = ['liUrl', 'gdUrl']
                Object.keys(company).forEach(key => {
                    if (ignoreKeys.includes(key)) return
                    const brKey = Object.entries(dataMap).find(entry => entry[1] === key)
                    if (brKey) {
                        if (!companyInBaserow[brKey[0]] && company[key]) {
                            console.log('replacing baserow data with db data: ', key)
                            companyInBaserow[brKey[0]] = company[key]
                        }
                    }
                })
            } else {
                newCompanies.push(company)
            }
        })

        // Update db with company data
        for (let i = 0; i < companiesInBaserow.length; i++) {
            let data = { ...companiesInBaserow[i] }
            try {
                data = convertToDBSchema(dataMap, data)
                delete data.gdLastUpdated
                delete data.liLastUpdated
                if (data.gdRating) data.gdRating = data.gdRating.toString()
                if (!data.imgUrl) data.imgUrl = 'https://'
                await axios.put(`${process.env.TECHJOBS_API}/api/updateCompany`, data)
                await new Promise((res, rej) => setTimeout(() => res(), 100))
            } catch (e) {
                if (e.response && e.response.status === 404) console.log(`Company ${data.name} not found in DB`)
                if (e.response && e.response.status === 400) console.log("error updating company in db!: ", e.response)
                if (!e.response) console.log(e)
            }
        }

        for (let i = 0; i < companiesInBaserow.length; i++) {
            const company = { ...companiesInBaserow[i] }
            const { id, ...data } = company
            try {
                console.log(`Updating ${company["field_67896"]} with ${company.id} to baserow..`)
                await axios({
                    method: "PATCH",
                    url: `https://api.baserow.io/api/database/rows/table/14835/${company.id}/`,
                    headers: {
                        Authorization: `Token ${process.env.BASEROW_API_KEY}`,
                        "Content-Type": "application/json",
                        "Retry-After": 120
                    },
                    data
                })
                // So we don't get rate limited
                await new Promise((res, rej) => setTimeout(() => res(), 100))
            } catch (e) {
                console.log("ERROR updating baserow new data!: ", e)
            }
        }

        // // Push all data to table

        for (let i=0;i<newCompanies.length;i++) {
            try {
                console.log(`Creating ${newCompanies[i]["name"]} to baserow..`)
                await axios({
                    method: "POST",
                    url: `https://api.baserow.io/api/database/rows/table/14835/`,
                    headers: {
                        Authorization: `Token ${process.env.BASEROW_API_KEY}`,
                        "Content-Type": "application/json",
                        "Retry-After": 120
                    },
                    data: convertToBaserowSchema(dataMap, newCompanies[i])
                })
                // So we don't get rate limited
                await new Promise((res, rej) => setTimeout(() => res(), 100))
            } catch (e) {
                console.log("ERROR!: ", e)
            }
        }

        // Sync data from LinkedIn scraper

        const companiesWithLinkedIn = [...companiesInBaserow.map(c => convertToDBSchema(dataMap, c, true)), ...newCompanies].filter(c => !!c.liUrl)

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
                const { id, airtableId, ...dataNoIds } = company
                await axios({
                    method: "PATCH",
                    url: `https://api.baserow.io/api/database/rows/table/14835/${id}/`,
                    headers: {
                        Authorization: `Token ${process.env.BASEROW_API_KEY}`,
                        "Content-Type": "application/json",
                        "Retry-After": 120
                    },
                    data: {
                        ...convertToBaserowSchema(dataMap, dataNoIds),
                        "field_67946": new Date().toISOString()
                    }
                })
            } catch (e) {
                console.log("ERROR updating li data!: ", e)
            }
        }

        // Sync data from Glassdoor scraper

        const companiesWithGlassdoor = [...companiesInBaserow.map(c => convertToDBSchema(dataMap, c, true)), ...newCompanies].filter(c => !!c.gdUrl)

        for (const co of companiesWithGlassdoor) {
            try {
                if (new Date() - new Date(co.gdLastUpdated) < (7 * 24 * 60 * 60 * 1000)) continue
                const company = { ...co }
                const scraper = require('./glassdoor-scraper').getGlassdoorData
                console.log(`Retrieving glassdoor data for ${company.name}`)
                const data = await scraper(company.gdUrl)
                if (!data) {
                    console.log('No data retrieved!')
                    continue
                }
                console.log(`Data successfully retrieved: ${JSON.stringify(data)}`)
                if (company.gdRating !== data.rating) company.gdRating = parseFloat(data.rating)
                if (company.gdReviewCount !== data.reviewCount) company.gdReviewCount = parseInt(data.reviewCount)
                const { id, airtableId, ...dataNoIds } = company
                await axios({
                    method: "PATCH",
                    url: `https://api.baserow.io/api/database/rows/table/14835/${id}/`,
                    headers: {
                        Authorization: `Token ${process.env.BASEROW_API_KEY}`,
                        "Content-Type": "application/json",
                        "Retry-After": 120
                    },
                    data: {
                        ...convertToBaserowSchema(dataMap, dataNoIds),
                        "field_67945": new Date().toISOString()
                    }
                })
            } catch (e) {
                console.log("ERROR updating gd data!: ", e)
            }
        }

    } catch (e) {
        console.log("ERROR!: ", e)
    }
}

(async () => {
    await sync()
})();

module.exports = {
    sync
}