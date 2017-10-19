import * as Block from './block'
import * as NodeApi from './node-api'
import * as NodeImpl from './node-impl'
import * as NodeTransfer from './node-transfer'
import * as TestTools from './test-tools'

import * as express from 'express'
import * as bodyParser from 'body-parser'

declare function ws(this: express.Server, url: string, callback: any)

declare module "express" {
    interface Server {
        ws(url: string, callback: any)
    }
}

export class NodeWebServer {
    constructor(private listeningPort: number,
        private node: NodeApi.NodeApi) { }

    initialize() {
        this.initServer()
    }

    private initServer() {
        let app = express()

        let expressWs = require('express-ws')(app)

        app.use(bodyParser.json())

        app.ws('/echo', (ws, req) => {
            // TODO close the listener sometime
            ws.send({ type: 'hello' })
            this.node.addEventListener('head', async () => ws.send({ type: 'head', newHead: await this.node.blockChainHead() }))
        })

        app.get('/ping', (req, res) => res.send(JSON.stringify({ message: 'hello' })))

        app.get('/mineSomething', async (req, res) => {
            let previousBlockId = await this.node.blockChainHead()
            let miner = TestTools.createSimpleMiner(previousBlockId, 10)
            let block = await miner()
            this.node.registerBlock(block)
        })

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

        app.listen(this.listeningPort, () => console.log(`Listening http on port ${this.listeningPort}`))
    }
}