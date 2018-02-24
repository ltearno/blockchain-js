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

        let listener = (branch: string) => {
            console.log(`receive branch ${branch} change`)
            try {
                this.fetchFromNode(remoteNode, branch)
            }
            catch (err) {
                console.error(`error when fetchAllBranchesFromNode for node: ${err}`)
            }
        }

        remoteNode.addEventListener('head', listener)

        this.listeners.push(listener)

        this.fetchAllBranchesFromNode(remoteNode)
    }

    private async fetchAllBranchesFromNode(remoteNode: NodeApi.NodeApi) {
        try {
            let branches = await remoteNode.branches()
            if (!branches) {
                console.log(`empty branch set, nothing to do...`)
                return
            }
            for (let branch of branches) {
                try {
                    await this.fetchFromNode(remoteNode, branch)
                }
                catch (err) {
                    console.log(`error when fetchAllBranchesFromNode for node: ${err}`)
                }
            }
        }
        catch (err) {
            console.log(`error when fetchAllBranchesFromNode for node: ${err}`)
        }
    }

    private async fetchFromNode(remoteNode: NodeApi.NodeApi, branch: string) {
        try {
            let remoteHead = await remoteNode.blockChainHead(branch)

            await this.registerBlockInFetchList(remoteHead, remoteNode)

            this.processBlockLoad()
        }
        catch (e) {
            console.log(`error : ${e}`)
        }
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
            return
        }

        this.isLoading = true

        try {
            if (this.fetchingItem.nodes.length == 0 || !this.fetchingItem.blockId) {
                this.fetchList.delete(this.fetchingItem.blockId)
                this.fetchingItem = null
                console.log(`no nodes or no blockId`)
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
                return
            }

            // remove the block from the fetch list and register the parent blocks for loading on that node
            let fetchedBlockId = this.fetchingItem.blockId
            this.fetchingItem = null
            this.fetchList.delete(fetchedBlockId)

            loadedBlock.previousBlockIds && loadedBlock.previousBlockIds.forEach(blockId => this.registerBlockInFetchList(blockId, nodeToFetchFrom))

            this.node.registerBlock(fetchedBlockId, loadedBlock)
        }
        finally {
            this.processBlockLoad()
        }
    }

    private async registerBlockInFetchList(id: string, node: NodeApi.NodeApi) {
        if (await this.node.knowsBlock(id))
            return

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

        for (let fetchItem of this.fetchList.values()) {
            if (fetchItem.nodes.length == 0 || await this.node.knowsBlock(fetchItem.blockId)) {
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