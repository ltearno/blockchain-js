import * as Block from './block'
import * as NodeApi from './node-api'
import * as NodeImpl from './node-impl'
import * as NodeTransfer from './node-transfer'

import * as express from 'express'
import * as bodyParser from 'body-parser'

// data structure
// node implementation
// mining
// node interaction
// -> network connection (REST API + WebSocket)
// extract and add data
// implement a chat application

declare function ws(this: express.Server, url: string, callback: any)

declare module "express" {
    interface Server {
        ws(url: string, callback: any)
    }
}

function createSimpleMiner(previousBlockId: string) {
    return async function () {
        console.log(`block creation`)
        let block = Block.createBlock(previousBlockId, [{ nom: "arnaud" }])

        console.log(`mining block`)
        let minedBlock = await Block.mineBlock(block, 1001)

        previousBlockId = await Block.idOfBlock(minedBlock)

        console.log(`mined block ${previousBlockId}`)
        return minedBlock
    }
}

let miner = createSimpleMiner(null)

/**
 * - Optionnaly serves a REST + WebSocket API
 * - has a list of peers to which fetch information from
 */
export class NodeWebServer {
    constructor(private listeningPort: number,
        private node: NodeApi.NodeApi) { }

    initialize() {
        this.initServer()
    }

    private initServer() {
        let app = express()

        let expressWs = require('express-ws')(app)

        app.use(bodyParser.json());

        app.ws('/echo', function (ws, req) {
            ws.on('message', function (msg) {
                ws.send(msg)
            })
        })

        app.get('/mineSomething', async (req, res) => this.node.registerBlock(await miner()))

        app.get('/blockChainHeadLog/:depth', async (req, res) => {
            let depth = 1 * (req.params.depth || 1)

            let result = await this.node.blockChainHeadLog(depth)
            res.send(JSON.stringify(result))
        })

        app.get('/blockChainBlockIds/:startBlockId/:depth', async (req, res) => {
            let depth = 1 * (req.params.depth || 1)
            let startBlockId = req.params.startBlockId

            let result = await this.node.blockChainBlockIds(startBlockId, depth)
            res.send(JSON.stringify(result))
        })

        /*
        app.post('/mineBlock', (req, res) => {
            var newBlock = generateNextBlock(req.body.data);
            addBlock(newBlock);
            broadcast(responseLatestMsg());
            console.log('block added: ' + JSON.stringify(newBlock));
            res.send();
        });
        app.get('/peers', (req, res) => {
            res.send(sockets.map(s => s._socket.remoteAddress + ':' + s._socket.remotePort));
        });
        app.post('/addPeer', (req, res) => {
            connectToPeers([req.body.peer]);
            res.send();
        });
        */

        app.get('/blocks', (req, res) => res.send(JSON.stringify({ message: 'hello' })))

        app.listen(this.listeningPort, () => console.log(`Listening http on port ${this.listeningPort}`))
    }
}

//let node = new NodeImpl.NodeImpl('original')
//let server = new NodeWebServer(9091, node)
//server.initialize()

otherTests()

async function otherTests() {
    let t1 = [false, null, { toto: 5, aa: 'titi' }, false, true, 5, 'toto', { 'none': false }]
    let t1ser = Block.serializeBlockData(t1)
    console.log(`${JSON.stringify(JSON.parse(t1ser))}`)

    console.log(`creating a node`)
    let node = new NodeImpl.NodeImpl('original')
    node.addEventListener('head', async () => console.log(`event : node has new head (${await node.currentBlockChainHead()})`))

    console.log(`current head: ${await node.currentBlockChainHead()}`)

    let nbToMine = 2
    while (nbToMine-- >= 0) {
        let minedBlock = await miner()

        console.log(`adding block to node`)
        let metadata = await node.registerBlock(minedBlock)
        console.log(`added block: ${JSON.stringify(metadata)}`)
    }


    /**
     * Node Interaction
     * 
     * node pumps data from known nodes (it subscribes to head and fetches missing blocks)
     * as node pumps data from other nodes, they refresh their head
     */

    let nodes = [node]
    for (let i = 0; i < 200; i++)
        nodes.push(new NodeImpl.NodeImpl(`node ${i}`))

    // contexts constructions
    let nodeContexts: NodeTransfer.NodeTransfer[] = nodes
        /*.map(node => new NodeTransfer.NodeTransfer(
            node,
            nodes.filter(n => n != node)
        ))*/
        .map((node, index) => new NodeTransfer.NodeTransfer(
            node,
            [nodes[(index + 1) % nodes.length]]
        ))

    // contexts init
    nodeContexts.forEach(context => context.initialize())

    nbToMine = 100
    while (nbToMine-- >= 0) {
        let minedBlock = await miner()

        let index = Math.floor(Math.random() * nodes.length)

        let nodeToRegisterBlock = nodes[index]

        while (!await nodeToRegisterBlock.knowsBlock(minedBlock.previousBlockId)) {
            await wait(300)
            console.log(`waiting for block availability on node ${nodeToRegisterBlock.name}`)
        }

        console.log(`adding block to node ${index}`)
        let metadata = await nodes[index].registerBlock(minedBlock)
    }
}

console.log(`finished`)

function wait(duration: number) {
    return new Promise((resolve, reject) => {
        setTimeout(() => resolve(), duration)
    })
}