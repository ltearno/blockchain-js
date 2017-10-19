import * as NodeImpl from './node-impl'
import * as NodeWebServer from './node-web-server'

let port = (process.argv.length >= 3 && parseInt(process.argv[2])) || 9091

let node = new NodeImpl.NodeImpl('original')
let server = new NodeWebServer.NodeWebServer(port, node)
server.initialize()