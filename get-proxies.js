const axios = require('axios')
const fs = require('fs')

async function getProxies() {
  const proxies = await axios.get('https://api.proxyscrape.com/?request=getproxies&proxytype=http&timeout=5000&country=all&ssl=yes&anonymity=all')

  fs.writeFileSync('./proxies.json', JSON.stringify(proxies.data.split("\r\n")));
}

function getProxy() {
    const proxies = require('./proxies.json');
    // get random index
    const index = Math.floor(Math.random() * proxies.length)
    const proxy = proxies[index].split(':')
    return [proxy[0], proxy[1]]
}

module.exports = {
    getProxy
};

(async () => {
    await getProxies()
})()