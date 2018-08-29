import * as Block from './block'
import * as NodeApi from './node-api'

interface FetchItem {
    blockId: string
    nodes: NodeApi.NodeApi[]
}

/**
 * Interaction between a node and a set of remote nodes
 * 
 * remote nodes can be added with the addRemoteNode function
 * they can be removed with the removeRemoteNode function
 */
export class NodeTransfer {
    private listeners: any[] = undefined
    private knownNodes: NodeApi.NodeApi[] = undefined

    private fetchingItem: FetchItem = null
    private fetchList = new Map<string, FetchItem>()
    isLoading: boolean = false

    constructor(public node: NodeApi.NodeApi) {
    }

    initialize(knownNodes: NodeApi.NodeApi[]) {
        this.listeners = []
        this.knownNodes = []

        knownNodes.forEach(node => this.initRemoteNode(node))
    }

    getKnownNodes() {
        return this.knownNodes
    }

    addRemoteNode(remoteNode: NodeApi.NodeApi) {
        this.initRemoteNode(remoteNode)
    }

    removeRemoteNode(remoteNode: NodeApi.NodeApi) {
        let index = this.knownNodes.indexOf(remoteNode)
        if (index < 0)
            return

        remoteNode.removeEventListener(this.listeners[index])
        this.listeners.splice(index, 1)
        this.knownNodes.splice(index, 1)
    }

    terminate() {
        this.knownNodes.forEach((remoteNode, index) => remoteNode.removeEventListener(this.listeners[index]))
        this.listeners = undefined
        this.node = undefined
        this.knownNodes = undefined
    }

    private initRemoteNode(remoteNode: NodeApi.NodeApi) {
        this.knownNodes.push(remoteNode)

        let listener: NodeApi.NodeEventListener<'head'> = async (event) => {
            console.log(`receive branch ${event.branch} change`)
            try {
                await this.registerBlockInFetchList(event.headBlockId, remoteNode)
                this.processBlockLoad()
            }
            catch (err) {
                console.error(`error when fetching branch ${event.branch}:${event.headBlockId} for node: ${err}`)
            }
        }

        remoteNode.addEventListener('head', listener)

        this.listeners.push(listener)
    }

    private async processBlockLoad() {
        if (this.fetchingItem) {
            console.log(`already fetching`)
            return
        }

        // to mark that we are searching for an item to load
        this.fetchingItem = {
            blockId: null,
            nodes: null
        }

        this.fetchingItem = await this.chooseFetchItemToLoad()
        if (!this.fetchingItem) {
            this.isLoading = false
            console.log(`cannot choose an item to load`)
            return
        }

        this.isLoading = true

        console.log(`fetching ${this.fetchingItem.blockId}`)

        try {
            if (this.fetchingItem.nodes.length == 0 || !this.fetchingItem.blockId) {
                this.fetchList.delete(this.fetchingItem.blockId)
                this.fetchingItem = null
                console.log(`no nodes or no blockId`)

                this.processBlockLoad()
                return
            }

            // fetch the block from this first available node and remove this node from the list,
            let nodeToFetchFrom = this.fetchingItem.nodes.shift()

            let loadedBlock: Block.Block = null
            try {
                let loadedBlocks = await nodeToFetchFrom.blockChainBlockData(this.fetchingItem.blockId, 1)
                loadedBlock = loadedBlocks && loadedBlocks.length && loadedBlocks[0]
            }
            catch (e) {
                console.log(`error fetching ${e}`)
            }

            // if error, push the node at the end of fetchList (for a later try)
            if (!loadedBlock) {
                this.fetchingItem.nodes.push(nodeToFetchFrom)
                this.fetchingItem = null
                console.log(`block not loaded`)

                this.processBlockLoad()
                return
            }

            // remove the block from the fetch list and register the parent blocks for loading on that node
            let fetchedBlockId = this.fetchingItem.blockId
            this.fetchingItem = null
            this.fetchList.delete(fetchedBlockId)

            if (loadedBlock.previousBlockIds) {
                for (let blockId of loadedBlock.previousBlockIds) {
                    console.log(`adding block ${blockId} to fetch list`)

                    await this.registerBlockInFetchList(blockId, nodeToFetchFrom)
                }
            }

            console.log(`block fetched, sending to local node`)

            this.node.registerBlock(fetchedBlockId, loadedBlock)

            this.processBlockLoad()
        }
        catch (e) {
            console.log(`error fetching ${e}`)

            this.processBlockLoad()
        }
    }

    private async registerBlockInFetchList(id: string, node: NodeApi.NodeApi) {
        if (await this.node.knowsBlock(id))
            return

        console.log(`register ${id}`)
        // TODO insert the block at random place in the list

        if (this.fetchList.has(id)) {
            if (!this.fetchList.get(id).nodes.includes(node))
                this.fetchList.get(id).nodes.push(node)
        }
        else {
            let fetchItem = {
                blockId: id,
                nodes: [node]
            }
            this.fetchList.set(id, fetchItem)
        }
    }

    private async chooseFetchItemToLoad() {
        // choose a block and clean blocks with no node in fetchList
        let toRemove = []
        let toProcess: FetchItem = null

        console.log(`fetchList size ${this.fetchList.size}`)

        for (let fetchItem of this.fetchList.values()) {
            console.log(`test ${fetchItem.blockId}`)

            if (await this.node.knowsBlock(fetchItem.blockId)) {
                toRemove.push()
            }
            else {
                toProcess = fetchItem
                break
            }
        }

        toRemove.forEach(blockId => this.fetchList.delete(blockId))

        return toProcess
    }
}