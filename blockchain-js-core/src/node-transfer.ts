import * as NodeApi from './node-api'

interface NodeInfo {
    node: NodeApi.NodeApi
    listener: NodeApi.NodeEventListener<'head'>
    lastEvents: { [branch: string]: { head: string } }
    isLoading: boolean
}

/**
 * Interaction between a node and a set of remote nodes
 * 
 * remote nodes can be added with the addRemoteNode function
 * they can be removed with the removeRemoteNode function
 */
export class NodeTransfer {
    private knownNodes: NodeInfo[] = undefined

    constructor(public node: NodeApi.NodeApi) {
    }

    isLoading() {
        return this.knownNodes.some(nodeInfo => nodeInfo.isLoading)
    }

    initialize(knownNodes: NodeApi.NodeApi[]) {
        this.knownNodes = []
        knownNodes.forEach(node => this.initRemoteNode(node))
    }

    addRemoteNode(remoteNode: NodeApi.NodeApi) {
        this.initRemoteNode(remoteNode)
    }

    removeRemoteNode(remoteNode: NodeApi.NodeApi) {
        this.knownNodes = this.knownNodes.filter(nodeInfo => {
            if (nodeInfo.node === remoteNode) {
                nodeInfo.node.removeEventListener(nodeInfo.listener)
                return false
            }

            return true
        })
    }

    terminate() {
        this.knownNodes.forEach(nodeInfo => nodeInfo.node.removeEventListener(nodeInfo.listener))
        this.node = undefined
        this.knownNodes = undefined
    }

    private initRemoteNode(remoteNode: NodeApi.NodeApi) {
        let nodeInfo: NodeInfo = {
            node: remoteNode,
            isLoading: false,
            listener: async (event) => {
                //console.log(`receive branch ${event.branch} change to ${event.headBlockId}`)
                nodeInfo.lastEvents[event.branch] = { head: event.headBlockId }
                this.triggerLoadFromRemoteNode(nodeInfo)
            },
            lastEvents: {}
        }

        this.knownNodes.push(nodeInfo)

        remoteNode.addEventListener('head', null, nodeInfo.listener)

        console.log(`added remote node for transfer`)
    }

    private async triggerLoadFromRemoteNode(nodeInfo: NodeInfo) {
        if (nodeInfo.isLoading)
            return

        nodeInfo.isLoading = true

        try {
            await this.loadFromRemoteNode(nodeInfo)
        } catch (error) {
            console.error(`error when loading from node: ${error}`, error)
        }

        nodeInfo.isLoading = false

        // something to do ?
        if (Object.keys(nodeInfo.lastEvents).length)
            setTimeout(() => this.triggerLoadFromRemoteNode(nodeInfo), 1)
    }

    // TODO if a block is known by the local node, it does not means that it known all the blocks down to the root block. check that!
    private async loadFromRemoteNode(nodeInfo: NodeInfo) {
        // find branch
        let branches = Object.keys(nodeInfo.lastEvents)
        if (!branches || !branches.length)
            return

        // find blockId
        let processedBranch = branches[0]
        let lastEvent = nodeInfo.lastEvents[processedBranch]
        if (!lastEvent)
            return
        let processedBlockId = lastEvent.head

        // load blocks
        let blockList = []
        blockList.push(processedBlockId)
        while (blockList.length) {
            let blockId = blockList.shift()

            if (await this.node.knowsBlockAsValidated(blockId))
                continue

            if (await this.node.knowsBlock(blockId)) {
                let blockData = (await this.node.blockChainBlockData(blockId, 1))[0]
                if (blockData && blockData.previousBlockIds)
                    blockData.previousBlockIds.reverse().forEach(parentBlockId => blockList.unshift(parentBlockId))
                continue
            }

            const BATCH_SIZE = 10
            let loadedBlockIds = await nodeInfo.node.blockChainBlockIds(blockId, BATCH_SIZE)

            let nbUnknownBlocks = 0
            for (let i = 0; i < loadedBlockIds.length; i++) {
                if (await this.node.knowsBlock(loadedBlockIds[i]))
                    break
                nbUnknownBlocks++
            }

            let loadedBlocks = await nodeInfo.node.blockChainBlockData(blockId, nbUnknownBlocks)
            if (loadedBlocks && loadedBlockIds) {
                for (let blockIdx = 0; blockIdx < loadedBlocks.length; blockIdx++) {
                    let loadedBlock = loadedBlocks[blockIdx]
                    let loadedBlockId = loadedBlockIds[blockIdx]

                    await this.node.registerBlock(loadedBlockId, loadedBlock)

                    if (loadedBlock.previousBlockIds) {
                        for (let idx = (blockIdx < loadedBlocks.length - 1 ? 1 : 0); idx < loadedBlock.previousBlockIds.length; idx++)
                            blockList.unshift(loadedBlock.previousBlockIds[idx])
                    }
                }
            }
        }

        // if last event is still the same, remove it
        if (nodeInfo.lastEvents[processedBranch] && nodeInfo.lastEvents[processedBranch].head == processedBlockId) {
            delete nodeInfo.lastEvents[processedBranch]
        }
    }
}