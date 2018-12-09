import * as express from 'express'
import * as bodyParser from 'body-parser'
import * as NodeNetworkServer from './node-network-server'
import * as NodeNetworkClient from './node-network-client'
import * as FullNode from './full-node'
import * as NetworkApiNodeImpl from './network-api-node-impl'
import * as http from 'http'
import * as https from 'https'
import * as fs from 'fs'
import * as BlockStoreDisk from './block-store-disk'

function parseArgs(parsed: any) {
    let args = process.argv.slice(2)
    let name = null
    for (let arg of args) {
        if (arg.startsWith('-')) {
            name = arg.substr(1)
        }
        else {
            let argType = typeof parsed[name]
            switch (argType) {
                case 'boolean':
                    parsed[name] = arg === 'true'
                    break

                case 'number':
                    parsed[name] = parseInt(arg)
                    break

                default:
                    parsed[name] = arg
                    break
            }
        }
    }
}

const run = async () => {
    const NETWORK_CLIENT_API = new NetworkApiNodeImpl.NetworkApiNodeImpl()

    let args = {
        port: 9091,
        persistent: false
    }
    parseArgs(args)
    console.log(`arguments : ${JSON.stringify(args)}`)

    // input parameters
    let port = args.port

    // TODO should use disk store only if param "disk" is set
    let blockStore = null

    if (args.persistent) {
        blockStore = new BlockStoreDisk.DiskBlockStore()
        await blockStore.init()
    }

    let fullNode = new FullNode.FullNode(null, blockStore)

    // node rest/ws servicing
    let app = express()
    app.use(bodyParser.json())

    let server

    if (fs.existsSync('key.pem') && fs.existsSync('cert.pem')) {
        server = https.createServer({
            key: fs.readFileSync('key.pem'),
            cert: fs.readFileSync('cert.pem')
        }, app)
    }
    else {
        server = http.createServer(app)
    }

    require('express-ws')(app, server)

    server.listen(port, '0.0.0.0', () => console.log(`listening https on port ${port}`))

    app.use(function (req, res, next) {
        res.header("Access-Control-Allow-Origin", "*")
        res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept")
        next()
    })

    let nodeServer = new NodeNetworkServer.NodeServer(
        fullNode.node,
        peerNode => fullNode.transfer.addRemoteNode(peerNode),
        peerNode => fullNode.transfer.removeRemoteNode(peerNode)
    )

    nodeServer.initialize(app)

    // mining facility
    app.get('/mineSomething/:branch', async (req, res) => {
        let branch = req.params.branch

        let data = { content: `some test data for you on branch ${branch}` }
        fullNode.miner.addData(branch, data)
        res.send(JSON.stringify(data))
    })

    // peer connections facility
    app.get('/peers', (req, res) => {
        let peers = fullNode.peerInfos.map(info => ({ id: info.id, description: info.description }))
        res.send(JSON.stringify(peers))
    })

    app.post('/peers', async (req, res) => {
        let peer = req.body as FullNode.Peer

        let peerInfo = {
            peer,
            fullNodePeerInfo: null
        }

        let peerNode = new NodeNetworkClient.NodeClient(
            fullNode.node,
            peer.address,
            peer.port,
            peer.secure,
            () => {
                if (peerInfo.fullNodePeerInfo)
                    fullNode.removePeer(peerInfo.fullNodePeerInfo.id)

                if (peer.autoReconnect) {
                    setTimeout(() => connect(), peer.autoReconnect > 0 ? peer.autoReconnect : 1)
                }
            },
            NETWORK_CLIENT_API
        )

        const connect = async () => {
            try {
                await peerNode.initialize()

                peerInfo.fullNodePeerInfo = fullNode.addPeer(peerNode.remoteFacade(), `peer added through REST: ${peer.address}:${peer.port}`)
            }
            catch (error) {
                console.log(`error connecting to peer ${JSON.stringify(peer)}`)

                if (peer.autoReconnect) {
                    setTimeout(() => connect(), peer.autoReconnect > 0 ? peer.autoReconnect : 1)
                }
            }
        }

        await connect()

        res.send(JSON.stringify({ id: peerInfo.fullNodePeerInfo ? peerInfo.fullNodePeerInfo.id : null }))
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

    app.get('/save', (req, res) => {
        let o = {}

        fullNode.node.blocks((blockId, block) => {
            o[blockId] = block
        })

        fs.writeFileSync(`blocks-${Date.now()}.data.json`, JSON.stringify(o, null, 2), 'utf-8')

        res.send(JSON.stringify({ message: 'ok' }, null, 2))
    })
}

run()

// smart contract facility