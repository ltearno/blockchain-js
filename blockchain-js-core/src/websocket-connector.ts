import * as Block from './block'
import * as NodeApi from './node-api'
import * as NetworkApi from './network-api'

const MAGIC_HELLO = "newdeal"

export interface Message {
    type: 'message' | 'reply' | 'hello' | 'event'
    id: string
    data: any
}

type Resolver<T> = (value?: boolean | PromiseLike<T>) => void

function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8)
        return v.toString(16)
    })
}

/**
 * Given a connected web socket,
 * 
 * allows to talk to remote node and receive calls from remote node too
 */
export class WebSocketConnector implements NodeApi.NodeApi {
    private waitingCalls: Map<string, Resolver<any>> = new Map()
    private remoteEventListeners: Map<string, NodeApi.NodeEventListener<keyof NodeApi.BlockchainEventMap>> = new Map()
    private localEventListeners: Map<string, NodeApi.NodeEventListener<keyof NodeApi.BlockchainEventMap>> = new Map()

    constructor(private localNode: NodeApi.NodeApi, private ws: NetworkApi.WebSocket) {
        ws.on('message', this.messageListener)

        ws.send(JSON.stringify({ id: null, type: 'hello', data: MAGIC_HELLO }))

        if (!this.localNode)
            console.warn(`localNode is null`)
    }

    private messageListener = async rawMessage => {
        try {
            let message = JSON.parse(rawMessage) as Message
            switch (message.type) {
                case 'hello':
                    if (!message.data || message.data != MAGIC_HELLO) {
                        console.warn(`refuse socket connection from client ${message.data}`)
                        this.ws.close()
                    }
                    break

                case 'event': {
                    let { listenerId, event } = message.data
                    if (this.remoteEventListeners.has(listenerId))
                        this.remoteEventListeners.get(listenerId)(event)
                    break
                }

                case 'message':
                    if (this.localNode) {
                        try {
                            let result = await this.messageToNode(message, this.localNode)
                            let payload = JSON.stringify({ id: message.id, type: 'reply', data: result })
                            this.ws.send(payload)
                        }
                        catch (error) {
                            console.log(`ERROR processing an incoming message : ${error}`)
                        }
                    }
                    break

                case 'reply':
                    this.onReplyMessage(message)
                    break
            }
        }
        catch (error) {
            console.warn(`recived shit through events websocket : ${rawMessage}`)
        }
    }

    // TODO other methods should check for termination nullity of localNode
    terminate() {
        // TODO remove listener to the ws
        // this.ws.unsubscribe(this.messageListener)
        this.localNode = null
        this.waitingCalls.clear()
        this.remoteEventListeners.clear()
        this.localEventListeners.clear()
    }

    knowsBlock(blockId: string): Promise<boolean> { return this.sendCall('knowsBlock', [blockId]) }
    knowsBlockAsValidated(blockId: string): Promise<boolean> { return this.sendCall('knowsBlockAsValidated', [blockId]) }
    branches(): Promise<string[]> { return this.sendCall('branches', []) }
    blockChainHead(branch: string): Promise<string> { return this.sendCall('blockChainHead', [branch]) }
    blockChainHeadLog(branch: string, depth: number): Promise<string[]> { return this.sendCall('blockChainHeadLog', [branch, depth]) }
    blockChainBlockIds(startBlockId: string, depth: number): Promise<string[]> { return this.sendCall('blockChainBlockIds', [startBlockId, depth]) }
    blockChainBlockMetadata(startBlockId: string, depth: number): Promise<Block.BlockMetadata[]> { return this.sendCall('blockChainBlockMetadata', [startBlockId, depth]) }
    blockChainBlockData(startBlockId: string, depth: number): Promise<Block.Block[]> { return this.sendCall('blockChainBlockData', [startBlockId, depth]) }
    registerBlock(blockId: string, block: Block.Block): Promise<Block.BlockMetadata> { return this.sendCall('registerBlock', [blockId, block]) }
    addEventListener<K extends keyof NodeApi.BlockchainEventMap>(type: K, options: NodeApi.BlockchainEventMap[K], listener: NodeApi.NodeEventListener<K>): void {
        let listenerId = `listener_${uuidv4()}`
        this.remoteEventListeners.set(listenerId, listener as NodeApi.NodeEventListener<keyof NodeApi.BlockchainEventMap>)
        this.sendCall('addEventListener', [type, listenerId, options], false)
    }
    removeEventListener<K extends keyof NodeApi.BlockchainEventMap>(eventListener: NodeApi.NodeEventListener<K>): void {
        for (let [listenerId, registeredEventListener] of this.remoteEventListeners.entries()) {
            if (registeredEventListener === eventListener) {
                this.sendCall('removeEventListener', [listenerId], false)
                this.remoteEventListeners.delete(listenerId)
                return
            }
        }
    }

    private sendCall<T>(method: string, parameters: any[], waitForReturn: boolean = true): Promise<T> {
        let id = `msg_${uuidv4()}`

        let res = null

        let message: Message = {
            id,
            type: 'message',
            data: { method, parameters }
        }

        let payload = JSON.stringify(message)

        //console.log(`ws send: ${payload}`)

        if (waitForReturn) {
            res = new Promise<T>((resolve, reject) => {
                try {
                    this.waitingCalls.set(id, resolve as Resolver<any>)
                    this.ws.send(payload)
                }
                catch (error) {
                    console.log(`ERROR sending waited return on web socket : ${error}`)
                    this.waitingCalls.delete(id)
                }
            })
        }
        else {
            try {
                this.ws.send(payload)
            }
            catch (error) {
                console.log(`ERROR sending result on web socket : ${error}`)
            }
        }


        return res
    }

    private onReplyMessage(message: Message) {
        if (!message)
            return
        if (message.type !== 'reply')
            return

        let resolve = this.waitingCalls.get(message.id)
        if (!resolve)
            return

        this.waitingCalls.delete(message.id)

        resolve(message.data)
    }

    /**
     * parse a message and calls a node
     * acts as a proxy
     * 
     * @param message message to parse
     * @param node node to send calls to
     */
    private async messageToNode(message: Message, node: NodeApi.NodeApi) {
        if (message.type !== 'message') {
            console.log(`oups, message not for me`)
            return
        }

        let { method, parameters } = message.data
        switch (method) {
            case 'addEventListener': {
                let [type, listenerId, options] = parameters
                let listener = event => {
                    try {
                        this.ws.send(JSON.stringify({ id: `event_${uuidv4()}`, type: 'event', data: { listenerId, event } }))
                    }
                    catch (error) {
                        console.log(`ERROR sending on web socket : ${error}`)

                        node.removeEventListener(listener)
                        this.localEventListeners.delete(listenerId)
                    }
                }
                this.localEventListeners.set(listenerId, listener)
                node.addEventListener(type, options, listener)
                return
            }

            case 'removeEventListener': {
                let [listenerId] = parameters
                if (this.localEventListeners.has(listenerId)) {
                    node.removeEventListener(this.localEventListeners.get(listenerId))
                    this.localEventListeners.delete(listenerId)
                }
                return
            }

            case 'ping':
                return message.id

            case 'branches':
                return await node.branches()

            case 'blockChainHead': {
                let [branch] = parameters

                return await node.blockChainHead(branch)
            }

            case 'blockChainBlockIds': {
                let [startBlockId, depth] = parameters
                depth = 1 * (depth || 1)

                return await node.blockChainBlockIds(startBlockId, depth)
            }

            case 'blockChainBlockMetadata': {
                let [startBlockId, depth] = parameters
                depth = 1 * (depth || 1)

                return await node.blockChainBlockMetadata(startBlockId, depth)
            }

            case 'blockChainBlockData': {
                let [startBlockId, depth] = parameters
                depth = 1 * (depth || 1)

                return await node.blockChainBlockData(startBlockId, depth)
            }

            case 'registerBlock': {
                let [blockId, block] = parameters

                // TODO check that input is a real block !
                console.log(`received block ${JSON.stringify(block)}`)
                return await node.registerBlock(blockId as string, block as Block.Block)
            }

            case 'knowsBlock': {
                let [blockId] = parameters

                return await node.knowsBlock(blockId)
            }

            case 'knownBlockAsValidated': {
                let [blockId] = parameters

                return await node.knowsBlockAsValidated(blockId)
            }
        }
    }
}