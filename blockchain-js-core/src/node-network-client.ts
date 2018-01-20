import * as Block from './block'
import * as NodeApi from './node-api'

import * as NetworkClientApi from './network-client-api'

// TODO : be sure to be compatible with both Node and Browser environments
// TODO : have a dependency injection tool to provide communication components
export class NodeClient implements NodeApi.NodeApi {
    private ws: NetworkClientApi.WebSocket
    private opened = false
    private connectScheduled = false
    private eventListeners: NodeApi.NodeEventListener[] = []
    private lastCallSuccess: boolean

    constructor(
        public name: string,
        private peerAddress: string,
        private peerPort: number,
        private networkApi: NetworkClientApi.NetworkClientApi) {
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
            this.ws = this.networkApi.createClientWebSocket(`ws://${this.peerAddress}:${this.peerPort}/events`)

            this.ws.on('message', (message) => {
                console.log(`[${this.name}] rx ws-msg ${message}`)
                try {
                    // TODO confirm type use
                    let data = JSON.parse(message as string)
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
        let url = `http://${this.peerAddress}:${this.peerPort}/${apiUrl}`
        return this.checkRemoteCall(() => this.networkApi.get(url))
    }

    private post<T>(apiUrl: string, data: any): Promise<T> {
        let url = `http://${this.peerAddress}:${this.peerPort}/${apiUrl}`
        return this.networkApi.post(url, data)
    }
}