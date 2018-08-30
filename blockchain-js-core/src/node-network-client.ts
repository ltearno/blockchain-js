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
            console.log(`error on NodeClient init, will be retried later...`)
        }
    }

    connect(): Promise<any> {
        return new Promise<any>((resolve, reject) => {
            if (this.opened)
                return

            if (this.ws) {
                this.ws.close()
                this.ws = null
            }

            try {
                this.ws = this.networkApi.createClientWebSocket(`ws://${this.peerAddress}:${this.peerPort}/events`)

                this.ws.on('open', () => {
                    this.opened = true

                    console.log(`web socket connected to ws://${this.peerAddress}:${this.peerPort}/events, instantiating`)
                    this.connector = new WebSocketConnector.WebSocketConnector(this.localNode, this.ws)

                    resolve()
                })

                this.ws.on('error', (err) => {
                    console.log(`error on ws, closing : ${err}`)
                })

                this.ws.on('close', () => {
                    this.connector && this.connector.terminate()
                    this.connector = null
                    this.opened = false
                    this.ws && this.ws.close()
                    this.ws = null

                    console.log('disconnected')
                    this.closeListener()
                })
            }
            catch (err) {
                console.log(`error on ws : ${err}`)
            }
        })
    }
}