import * as NodeImpl from './node-impl'
import * as NodeNetwork from './node-network'
import * as NodeTransfer from './node-transfer'
import * as Tools from './tools'
import * as TestTools from './test-tools'
import * as MinerImpl from './miner-impl'
import * as ListOnChain from './list-on-chain'

// input parameters
let port = (process.argv.length >= 3 && parseInt(process.argv[2])) || 9091

// node creation
let node = new NodeImpl.NodeImpl('original')

// miner
let miner = new MinerImpl.MinerImpl(node)

// node rest/ws servicing
let app = Tools.createExpressApp(port)
let server = new NodeNetwork.NodeServer(node)
server.initialize(app)

// mining facility
app.get('/mineSomething', async (req, res) => {
    let data = { content: 'some test data for you' }
    miner.addData(data)
    res.send(JSON.stringify(data))
})

// peer connections facility
let transfer = new NodeTransfer.NodeTransfer(node)
transfer.initialize([])

interface Peer {
    address: string
    port: number
}

let nextPeerId = 1
let peerInfos: {
    id: number
    client: NodeNetwork.NodeClient
}[] = []

app.get('/peers', (req, res) => {
    let peers = peerInfos.map(info => ({ id: info.id, name: info.client.name }))
    res.send(JSON.stringify(peers))
})

app.post('/peers', async (req, res) => {
    let peer = req.body as Peer

    let info = {
        id: nextPeerId++,
        client: new NodeNetwork.NodeClient(`remote-node-${peer.address}-${peer.port}`, peer.address, peer.port)
    }

    info.client.initialize()
    transfer.addRemoteNode(info.client)
    peerInfos.push(info)

    res.send(JSON.stringify({ id: info.id }))
})

app.delete('/peers/:id', async (req, res) => {
    let id = parseInt(req.params.id)

    let info = peerInfos.find(p => p.id == id)
    if (info) {
        transfer.removeRemoteNode(info.client)
        peerInfos = peerInfos.filter(p => p != info)
    }

    res.send(JSON.stringify({ result: 'ok' }))
})

// list facility
let listOnChain = new ListOnChain.ListOnChain(node, 'main', miner)
listOnChain.initialise()

app.get('/list', (req, res) => {
    res.send(JSON.stringify(listOnChain.getList()))
})

app.get('/list/status/:tx', (req, res) => {
    let tx = req.params.tx

    let confirmation = listOnChain.isItemConfirmed(tx)

    let status = 'unconfirmed'
    if (confirmation === true)
        status = 'confirmed'
    else if (confirmation === false)
        status = 'invalidated'

    res.send(JSON.stringify({ tx, status }))
})

app.post('/list', (req, res) => {
    let item = req.body

    listOnChain.addToList([item]).then(tx => res.send(JSON.stringify({ tx })))
})