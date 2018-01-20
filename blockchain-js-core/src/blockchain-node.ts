import * as NodeNetworkServer from './node-network-server'
import * as NodeNetworkClient from './node-network-client'
import * as Tools from './tools'
import * as FullNode from './full-node'
import * as NetworkClientNodeImpl from './network-client-node-impl'

const NETWORK_CLIENT_API = new NetworkClientNodeImpl.NetworkClientNodeImpl()

let fullNode = new FullNode.FullNode(NETWORK_CLIENT_API)

// input parameters
let port = (process.argv.length >= 3 && parseInt(process.argv[2])) || 9091

// node rest/ws servicing
let app = Tools.createExpressApp(port)
app.use(function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "*")
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept")
    next()
})
let server = new NodeNetworkServer.NodeServer(fullNode.node)
server.initialize(app)

// mining facility
app.get('/mineSomething/:branch', async (req, res) => {
    let branch = req.params.branch

    let data = { content: 'some test data for you' }
    fullNode.miner.addData(branch, data)
    res.send(JSON.stringify(data))
})

// peer connections facility
app.get('/peers', (req, res) => {
    let peers = fullNode.peerInfos.map(info => ({ id: info.id, name: info.client.name, status: info.client.status() }))
    res.send(JSON.stringify(peers))
})

app.post('/peers', async (req, res) => {
    let peer = req.body as FullNode.Peer

    let info = fullNode.addPeer(peer)

    res.send(JSON.stringify({ id: info.id }))
})

app.delete('/peers/:id', async (req, res) => {
    let id = parseInt(req.params.id)

    let result = fullNode.removePeer(id)

    res.send(JSON.stringify({ result: result ? 'peer deleted' : 'peer not found' }))
})

// list facility
app.get('/lists/:branch/:listName', (req, res) => {
    let branch = req.params.branch
    let listName = req.params.listName

    res.send(JSON.stringify(fullNode.getListOnChain(branch, listName).getList()))
})

app.get('/lists/:branch/:listName/status/:tx', (req, res) => {
    let branch = req.params.branch
    let listName = req.params.listName
    let tx = req.params.tx

    let confirmation = fullNode.getListOnChain(branch, listName).isItemConfirmed(tx)

    let status = 'unconfirmed'
    if (confirmation === true)
        status = 'confirmed'
    else if (confirmation === false)
        status = 'invalidated'

    res.send(JSON.stringify({ tx, status }))
})

app.post('/lists/:branch/:listName', async (req, res) => {
    try {
        let branch = req.params.branch
        let listName = req.params.listName

        let item = req.body

        let tx = await fullNode.getListOnChain(branch, listName).addToList([item])

        res.send(JSON.stringify({ tx }))
    }
    catch (error) {
        res.send(JSON.stringify(error))
    }
})