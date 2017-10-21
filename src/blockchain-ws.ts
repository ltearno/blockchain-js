import * as NodeImpl from './node-impl'
import * as NodeNetwork from './node-network'
import * as Tools from './tools'

let port = (process.argv.length >= 3 && parseInt(process.argv[2])) || 9091

let app = Tools.createExpressApp(port)
let node = new NodeImpl.NodeImpl('original')
let server = new NodeNetwork.NodeServer(node)
server.initialize(app)