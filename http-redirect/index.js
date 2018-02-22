let http = require('http')
let httpPort = (process.argv.length >= 3 && parseInt(process.argv[2])) || 8080

http.createServer((request, response) => {
    response.writeHead(302, { 'Location': 'https://blockchain-js.com' })
    response.end()
}).listen(httpPort)

console.log(`listening http on ${httpPort}`)