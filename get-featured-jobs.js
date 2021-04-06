

const reuploadImages = require('./techinasia-scraper').reuploadImages
const showdown = require('showdown'), converter = new showdown.Converter()

async function getFeaturedJobs() {
    try {
        const base = require('airtable').base('appjZBRulMFmg0cOi');
        const axios = require('axios')
        // Get jobs from AT that do not have IDs

        const jobsToAdd = []

        await base('job submissions').select({ view: "Grid view" }).eachPage((records, fetchNextPage) => {
            records.forEach(function (record) {
                if (!record.get('id')) {
                    if (record.get('Job Name')) {
                        jobsToAdd.push({
                            ...record.fields,
                            airtableId: record.id
                        })
                    }
                }
            });
            fetchNextPage();
        })

        // Loop through jobs to add

        for (let i = 0; i < jobsToAdd.length; i++) {
            setTimeout(() => {
                jobsToAdd.map(async job => {
                    try {
                        // Massage fields to JSON

                        let avatar = job["Job / Company avatar"]
                        if (avatar && !avatar.includes('imgur')) {
                            const newImg = await reuploadImages(avatar)
                            if (newImg && newImg !== 'undefined') {
                                avatar = newImg
                            }
                        }

                        let description = converter.makeHtml(job["About the job"]).replace(/\n/g, '</p><p>');

                        const data = {
                            name: job["Job Name"],
                            avatar: avatar || "",
                            url: job["Job url"],
                            company: job["Company name"],
                            description: description || "",
                            tags: job["Job tags"].split('\n'),
                            type: "featured"
                        }

                        // Add job

                        const addJobResponse = await axios.post(`${process.env.TECHJOBS_API}/api/createJob`, data)

                        // Update company

                        let companyAbout = converter.makeHtml(job["About the company"]).replace(/\n/g, '</p><p>');

                        const company = {
                            name: job["Company name"],
                            imgUrl: avatar || "",
                            url: job["Company url"],
                            about: companyAbout
                        }

                        await axios.put(`${process.env.TECHJOBS_API}/api/updateCompany`, company)

                        // Update job in airtable with returned ID

                        await base('job submissions').update([{
                            id: job.airtableId,
                            fields: {
                                id: `${addJobResponse.data.id}`
                            }
                        }])
                    } catch (e) {
                        console.log(e)
                        console.log(job)
                    }
                })
            }, i * 1000)
        }

    } catch (e) {
        console.log(e)
    }
}

(async () => {
    await getFeaturedJobs()
})();

module.exports = {
    getFeaturedJobs
}