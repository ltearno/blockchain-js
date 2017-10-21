import * as Block from './block'
import * as NodeApi from './node-api'
import * as NodeImpl from './node-impl'
import * as NodeTransfer from './node-transfer'
import * as TestTools from './test-tools'

import * as express from 'express'
import * as bodyParser from 'body-parser'
import * as WebSocket from 'ws'
import * as Request from 'request'

declare function ws(this: express.Server, url: string, callback: any)

declare module "express" {
    interface Server {
        ws(url: string, callback: any)
    }
}

export class NodeClient implements NodeApi.NodeApi {
    private ws: WebSocket
    private eventListeners: NodeApi.NodeEventListener[] = []

    constructor(
        public name: string,
        private peerAddress: string,
        private peerPort: number) {
    }

    initialize() {
        this.ws = new WebSocket(`ws://${this.peerAddress}:${this.peerPort}/events`)

        this.ws.on('message', (message) => {
            console.log(`[${this.name}] rx ws-msg ${message}`)
            try {
                let data = JSON.parse(message)
                if (data && data.type && data.type == 'head')
                    this.eventListeners.forEach(listener => listener())
            }
            catch (err) {
                console.log(`[${this.name}] error while processing ws message '${err}'`)
            }
        })

        this.ws.on('open', () => {
            console.log(`[${this.name}] web socket connected`)
            this.ws.send(JSON.stringify({ type: 'hello' }))
        })

        this.ws.on('close', () => {
            console.log('disconnected')
        })
    }

    async knowsBlock(blockId: string): Promise<boolean> {
        return await this.get<boolean>(`knowsBlock/${blockId}`)
    }

    async blockChainHead(): Promise<string> {
        return await this.get<string>('blockChainHead')
    }

    async blockChainHeadLog(depth: number): Promise<string[]> {
        return await this.get<string[]>(`blockChainHeadLog/${depth}`)
    }

    async blockChainBlockIds(startBlockId: string, depth: number): Promise<string[]> {
        return await this.get<string[]>(`blockChainBlockIds/${startBlockId}/${depth}`)
    }

    async blockChainBlockMetadata(startBlockId: string, depth: number): Promise<Block.BlockMetadata[]> {
        return await this.get<Block.BlockMetadata[]>(`blockChainBlockMetadata/${startBlockId}/${depth}`)
    }

    async blockChainBlockData(startBlockId: string, depth: number): Promise<Block.Block[]> {
        return await this.get<Block.Block[]>(`blockChainBlockData/${startBlockId}/${depth}`)
    }

    async registerBlock(minedBlock: Block.Block): Promise<Block.BlockMetadata> {
        return await this.post<Block.BlockMetadata>(`registerBlock`, minedBlock)
    }

    addEventListener(type: 'head', eventListener: NodeApi.NodeEventListener): void {
        this.eventListeners.push(eventListener)
    }

    removeEventListener(eventListener: NodeApi.NodeEventListener): void {
        this.eventListeners = this.eventListeners.filter(listener => listener != eventListener)
    }

    private get<T>(apiUrl: string): Promise<T> {
        return new Promise((resolve, reject) => {
            let url = `http://${this.peerAddress}:${this.peerPort}/${apiUrl}`
            //console.log(`GETting ${url}`)
            Request.get(url, (error, response, body) => {
                if (error) {
                    reject(error)
                    return
                }

                try {
                    resolve(JSON.parse(body))
                }
                catch (err) {
                    reject(err)
                }
            })
        })
    }

    private post<T>(apiUrl: string, data: any): Promise<T> {
        return new Promise((resolve, reject) => {
            let url = `http://${this.peerAddress}:${this.peerPort}/${apiUrl}`
            //console.log(`POSTing ${url}`)
            Request.post(
                url, {
                    method: 'POST',
                    json: true,
                    body: data
                }, (error, response, body) => {
                    if (error) {
                        reject(error)
                        return
                    }

                    try {
                        resolve(body)
                    }
                    catch (err) {
                        reject(err)
                    }
                })
        })
    }
}

export class NodeServer {
    constructor(private node: NodeApi.NodeApi) { }

    initialize(app: express.Server) {
        app.ws('/events', (ws, req) => {
            // TODO close the listener sometime
            ws.on('message', message => console.log(`rcv: ${message}`))
            ws.send(JSON.stringify({ type: 'hello' }))
            this.node.addEventListener('head', async () => ws.send(JSON.stringify({ type: 'head', newHead: await this.node.blockChainHead() })))
        })

        app.get('/ping', (req, res) => res.send(JSON.stringify({ message: 'hello' })))

        app.get('/blockChainHead', async (req, res) => {
            let result = await this.node.blockChainHead()
            res.send(JSON.stringify(result))
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
            let metadata = await this.node.registerBlock(req.body as Block.Block)
            res.send(JSON.stringify(metadata))
        })

        app.get('/knowsBlock/:blockId', async (req, res) => {
            let blockId = req.params.blockId

            let result = await this.node.knowsBlock(blockId)
            res.send(JSON.stringify(result))
        })
    }
}