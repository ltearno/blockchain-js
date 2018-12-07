import * as Block from './block'
import * as NodeApi from './node-api'
import * as NodeImpl from './node-impl'
import * as NodeTransfer from './node-transfer'
import * as TestTools from './test-tools'
import * as NetworkApi from './network-api'
import * as WebSocketConnector from './websocket-connector'
import * as express from 'express'
import * as bodyParser from 'body-parser'
import * as WebSocket from 'ws'
import * as Request from 'request'
import { MinerApi, MinerImpl } from '.';

declare function ws(this: express.Server, url: string, callback: any)

declare module "express" {
    interface Server {
        ws(url: string, callback: any)
    }
}

export class NodeServer {
    private miner: MinerApi.MinerApi

    constructor(
        private node: NodeApi.NodeApi,
        private newPeersReceiver: (peer: NodeApi.NodeApi) => void,
        private closedPeersReceiver: (peer: NodeApi.NodeApi) => void) {
        this.miner = new MinerImpl.MinerImpl(node)
    }

    nbEventsWebSockets = 0

    // TODO check all input's validity !

    initialize(app: express.Server) {
        app.ws('/events', (ws, req) => {
            this.nbEventsWebSockets++

            console.log(`opened ws (${this.nbEventsWebSockets})`)

            let connector = new WebSocketConnector.WebSocketConnector(this.node, ws)
            this.newPeersReceiver(connector)

            ws.on('error', err => {
                console.log(`error on ws ${err}`)
                ws.close()
            })

            ws.on('close', () => {
                this.nbEventsWebSockets--

                console.log(`closed ws (${this.nbEventsWebSockets})`)
                connector.terminate()
                this.closedPeersReceiver(connector)
            })
        })

        app.ws('/mining', (ws, req) => {
            ws.on('message', async rawMessage => {
                try {
                    let { branch, data } = JSON.parse(rawMessage)
                    this.miner.addData(branch, data)
                }
                catch (error) {
                    console.warn(`recived shit through mining websocket : ${rawMessage}`)
                }
            })

            ws.on('error', err => {
                console.log(`error on mining ws ${err}`)
                ws.close()
            })

            ws.on('close', () => {
                console.log(`closed mining ws`)
            })
        })

        app.get('/ping', (req, res) => res.send(JSON.stringify({ message: 'hello' })))

        app.get('/branches', async (req, res) => res.send(JSON.stringify(await this.node.branches())))

        app.get('/blockChainHead/:branch', async (req, res) => {
            let branch = req.params.branch

            let result = await this.node.blockChainHead(branch)
            res.send(JSON.stringify(result))
        })

        app.get('/blockChainBlockIds/:startBlockId/:depth', async (req, res) => {
            let depth = 1 * (req.params.depth || 1)
            let startBlockId = req.params.startBlockId

            let result = await this.node.blockChainBlockIds(startBlockId, depth)
            res.send(JSON.stringify(result))
        })

        app.get('/blockChainBlockMetadata/:startBlockId/:depth', async (req, res) => {
            let depth = 1 * (req.params.depth || 1)
            let startBlockId = req.params.startBlockId

            let result = await this.node.blockChainBlockMetadata(startBlockId, depth)
            res.send(JSON.stringify(result))
        })

        app.get('/blockChainBlockData/:startBlockId/:depth', async (req, res) => {
            let depth = 1 * (req.params.depth || 1)
            let startBlockId = req.params.startBlockId

            let result = await this.node.blockChainBlockData(startBlockId, depth)
            res.send(JSON.stringify(result))
        })

        app.post('/registerBlock', async (req, res) => {
            // TODO check that input is a real block !
            console.log(`received block ${JSON.stringify(req.body)}`)
            let block = req.body as Block.Block
            let blockId = await Block.idOfBlock(block)
            let metadata = await this.node.registerBlock(blockId, block)
            res.send(JSON.stringify(metadata))
        })

        app.get('/knowsBlock/:blockId', async (req, res) => {
            let blockId = req.params.blockId

            let result = await this.node.knowsBlock(blockId)
            res.send(JSON.stringify(result))
        })
    }
}