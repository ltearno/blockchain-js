import * as NodeApi from './node-api'
import * as WebSocketConnector from './websocket-connector'
import * as NetworkApi from './network-api'

/**
 * Network connection to a remote node
 * 
 * a local node is provided to comunnicate
 * a network address is provided to connect to the remote node
 */
export class NodeClient {
    private ws: NetworkApi.WebSocket
    private opened = false
    private connector: WebSocketConnector.WebSocketConnector

    constructor(
        public localNode: NodeApi.NodeApi,
        private peerAddress: string,
        private peerPort: number,
        private peerSecure: boolean,
        private closeListener: () => void,
        private networkApi: NetworkApi.NetworkApi) {
    }

    remoteFacade() {
        return this.connector
    }

    status() {
        return `WS-${this.peerAddress}-${this.peerPort}:${this.opened ? 'OK' : 'KO'}`
    }

    async initialize(): Promise<any> {
        try {
            await this.connect()
        }
        catch (err) {
            console.log(`error on NodeClient init...`)
        }
    }

    connect(): Promise<any> {
        return new Promise<any>((resolve, reject) => {
            if (this.opened)
                return

            if (this.ws) {
                this.ws.close()
                this.finish()
            }

            try {
                let url = `${this.peerSecure ? 'wss' : 'ws'}://${this.peerAddress}:${this.peerPort}/events`

                this.ws = this.networkApi.createClientWebSocket(url)

                this.ws.on('open', () => {
                    this.opened = true

                    console.log(`web socket connected to ${url}, instantiating`)
                    this.connector = new WebSocketConnector.WebSocketConnector(this.localNode, this.ws)

                    resolve()
                })

                this.ws.on('error', (err) => {
                    if (!this.opened) {
                        this.finish()
                    }
                    else {
                        console.log(`error on ws ${url}, closing : ${err}`)
                        this.ws.close()
                    }
                })

                this.ws.on('close', () => {
                    if (this.opened)
                        console.log(`web socket disconnected from ${url}`)
                    this.finish()
                })
            }
            catch (err) {
                console.log(`error on ws : ${err}`)
            }
        })
    }

    private finish() {
        if (!this.ws)
            return

        this.connector && this.connector.terminate()
        this.connector = null
        this.opened = false
        this.ws = null

        this.closeListener()
    }
}