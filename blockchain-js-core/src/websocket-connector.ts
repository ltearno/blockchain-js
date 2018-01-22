import * as Block from './block'
import * as NodeApi from './node-api'
import * as NetworkApi from './network-api'

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
    name: string = 'unconnected-not-yet-known'

    private waitingCalls: Map<string, Resolver<any>> = new Map()
    private remoteEventListeners: Map<string, NodeApi.NodeEventListener> = new Map()
    private localEventListeners: Map<string, NodeApi.NodeEventListener> = new Map()

    constructor(private localNode: NodeApi.NodeApi, private ws: NetworkApi.WebSocket) {
        ws.on('message', this.messageListener)

        if (this.localNode)
            ws.send(JSON.stringify({ id: null, type: 'hello', data: this.localNode.name }))
        else
            console.log(`WARNING : localNode is null`)
    }

    private messageListener = async rawMessage => {
        console.log(`ws rcv: ${rawMessage}`)
        let message = JSON.parse(rawMessage) as Message
        switch (message.type) {
            case 'hello':
                this.name = `proxy-to-${message.data}`
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
                        console.log(`ws reply: ${payload}`)
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

    // TODO other methods should check for termination nullity of localNode
    terminate() {
        // TODO remove listener to the ws
        // this.ws.unsubscribe(this.messageListener)
        this.localNode = null
        this.name = `_TERMINATED_${this.name}`
        this.waitingCalls.clear()
        this.remoteEventListeners.clear()
        this.localEventListeners.clear()
    }

    knowsBlock(blockId: string): Promise<boolean> { return this.sendCall('knowsBlock', [blockId]) }
    branches(): Promise<string[]> { return this.sendCall('branches', []) }
    blockChainHead(branch: string): Promise<string> { return this.sendCall('blockChainHead', [branch]) }
    blockChainHeadLog(branch: string, depth: number): Promise<string[]> { return this.sendCall('blockChainHeadLog', [branch, depth]) }
    blockChainBlockIds(startBlockId: string, depth: number): Promise<string[]> { return this.sendCall('blockChainBlockIds', [startBlockId, depth]) }
    blockChainBlockMetadata(startBlockId: string, depth: number): Promise<Block.BlockMetadata[]> { return this.sendCall('blockChainBlockMetadata', [startBlockId, depth]) }
    blockChainBlockData(startBlockId: string, depth: number): Promise<Block.Block[]> { return this.sendCall('blockChainBlockData', [startBlockId, depth]) }
    registerBlock(minedBlock: Block.Block): Promise<Block.BlockMetadata> { return this.sendCall('registerBlock', [minedBlock]) }
    addEventListener(type: "head", eventListener: NodeApi.NodeEventListener): void {
        let listenerId = `listener_${uuidv4()}`
        this.remoteEventListeners.set(listenerId, eventListener)
        this.sendCall('addEventListener', [type, listenerId], false)
    }
    removeEventListener(eventListener: NodeApi.NodeEventListener): void {
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

        console.log(`ws send: ${payload}`)

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
        console.log(`analysing method ${method}`)
        switch (method) {
            case 'addEventListener': {
                let [type, listenerId] = parameters
                let listener = event => {
                    try {
                        this.ws.send(JSON.stringify({ id: `event_${uuidv4()}`, type: 'event', data: { listenerId, event } }))
                    }
                    catch (error) {
                        console.log(`ERROR sending on web socket : ${error}`)
                    }
                }
                this.localEventListeners.set(listenerId, listenerId)
                node.addEventListener(type, listener)
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

            case 'blockChainHeadLog': {
                let [branch, depth] = parameters
                depth = 1 * (depth || 1)

                return await node.blockChainHeadLog(branch, depth)
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
                let [block] = parameters

                // TODO check that input is a real block !
                console.log(`received block ${JSON.stringify(block)}`)
                return await node.registerBlock(block as Block.Block)
            }

            case 'knowsBlock': {
                let [blockId] = parameters

                return await node.knowsBlock(blockId)
            }
        }
    }
}