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
    private opened = false
    private connectScheduled = false
    private eventListeners: NodeApi.NodeEventListener[] = []
    private lastCallSuccess: boolean

    constructor(
        public name: string,
        private peerAddress: string,
        private peerPort: number) {
    }

    status() {
        return `WS:${this.opened ? 'OK' : 'KO'} - last request:${this.lastCallSuccess ? 'OK' : 'KO'}`
    }

    initialize() {
        try {
            this.connect()
        }
        catch (err) {
            console.log(`error on NodeClient init, will be retried later...`)
        }
    }

    connect() {
        if (this.opened)
            return

        if (this.ws) {
            this.ws.close()
            this.ws = null
        }

        let clearConnectionAndReconnect = () => {
            this.opened = false
            this.ws && this.ws.close()
            this.ws = null

            this.maybeRescheduleConnect()
        }

        try {
            this.ws = new WebSocket(`ws://${this.peerAddress}:${this.peerPort}/events`)

            this.ws.on('message', (message) => {
                console.log(`[${this.name}] rx ws-msg ${message}`)
                try {
                    let data = JSON.parse(message)
                    if (data && data.type && data.type == 'head' && data.branch)
                        this.eventListeners.forEach(listener => listener(data.branch))
                }
                catch (err) {
                    console.log(`[${this.name}] error while processing ws message '${err}'`)
                }
            })

            this.ws.on('open', () => {
                this.opened = true

                console.log(`[${this.name}] web socket connected`)
                try {
                    this.ws.send(JSON.stringify({ type: 'ping' }))
                }
                catch (err) {
                    console.log(`error on ws : ${err}`)
                }
            })

            this.ws.on('close', () => {
                clearConnectionAndReconnect()

                console.log('disconnected')
            })

            this.ws.on('error', (err) => {
                clearConnectionAndReconnect()

                console.log(`error on ws : ${err}`)
            })
        }
        catch (err) {
            console.log(`error on ws : ${err}`)
        }
    }

    private maybeRescheduleConnect() {
        if (this.connectScheduled)
            return
        this.connectScheduled = true

        console.log(`scheduling reconnect in 5 seconds`)

        setTimeout(() => {
            this.connectScheduled = false
            this.connect()
        }, 5000)
    }

    private async checkRemoteCall<T>(callback: () => Promise<T>) {
        try {
            let result = await callback()
            this.lastCallSuccess = true
            return result
        }
        catch (err) {
            this.lastCallSuccess = false
            throw err
        }
    }

    async knowsBlock(blockId: string): Promise<boolean> {
        return await this.get<boolean>(`knowsBlock/${blockId}`)
    }

    async branches(): Promise<string[]> {
        return await this.get<string[]>(`branches`)
    }

    async blockChainHead(branch: string): Promise<string> {
        return await this.get<string>(`blockChainHead/${branch}`)
    }

    async blockChainHeadLog(branch: string, depth: number): Promise<string[]> {
        return await this.get<string[]>(`blockChainHeadLog/${branch}/${depth}`)
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
        return this.checkRemoteCall(() => new Promise((resolve, reject) => {
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
        }))
    }

    private post<T>(apiUrl: string, data: any): Promise<T> {
        return this.checkRemoteCall(() => new Promise((resolve, reject) => {
            let url = `http://${this.peerAddress}:${this.peerPort}/${apiUrl}`
            //console.log(`POSTing ${url}`)
            Request.post(
                url, {
                    method: 'POST',
                    json: true,
                    body: data
                }, (error, response, body) => {
                    if (error)
                        reject(error)
                    else
                        resolve(body)
                })
        }))
    }
}

export class NodeServer {
    constructor(private node: NodeApi.NodeApi) { }

    // TODO check all input's validity !

    initialize(app: express.Server) {
        app.ws('/events', (ws, req) => {
            let listener = async (branch) => ws.send(JSON.stringify({ type: 'head', branch }))
            ws.on('error', err => {
                console.log(`error on ws ${err}`)
                ws.close()
            })

            ws.on('close', () => {
                console.log(`closed ws`)
                this.node.removeEventListener(listener)
            })

            ws.on('message', message => console.log(`rcv: ${message}`))

            ws.send(JSON.stringify({ type: 'hello' }))

            this.node.addEventListener('head', listener)
        })

        app.get('/ping', (req, res) => res.send(JSON.stringify({ message: 'hello' })))

        app.get('/branches', async (req, res) => res.send(JSON.stringify(await this.node.branches())))

        app.get('/blockChainHead/:branch', async (req, res) => {
            let branch = req.params.branch

            let result = await this.node.blockChainHead(branch)
            res.send(JSON.stringify(result))
        })

        app.get('/blockChainHeadLog/:depth', async (req, res) => {
            let branch = req.params.branch
            let depth = 1 * (req.params.depth || 1)

            let result = await this.node.blockChainHeadLog(branch, depth)
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