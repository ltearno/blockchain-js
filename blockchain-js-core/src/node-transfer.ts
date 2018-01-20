import * as Block from './block'
import * as NodeApi from './node-api'

export class NodeTransfer {
    private listeners: any[] = undefined
    private knownNodes: NodeApi.NodeApi[] = undefined

    constructor(
        public node: NodeApi.NodeApi
    ) {
        node.addEventListener('head', async (branch) => {
            let head = await node.blockChainHead(branch)
            let blocks = await node.blockChainBlockData(head, 1)
            let block = blocks && blocks.length && blocks[0]
            if (!block)
                return
            for (let knownNode of this.knownNodes) {
                knownNode.registerBlock(block)
            }
        })
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
        // TODO : fetch remote node's head and register blocks we have but he does not

        this.knownNodes.push(remoteNode)

        let listener = (branch: string) => {
            console.log(`[${this.node.name}] receive branch ${branch} change from ${remoteNode.name}`)
            try {
                this.fetchFromNode(remoteNode, branch)
            }
            catch (err) {
                console.log(`error when fetchAllBranchesFromNode for node ${remoteNode.name}: ${err}`)
            }
        }

        remoteNode.addEventListener('head', listener)

        this.listeners.push(listener)

        this.fetchAllBranchesFromNode(remoteNode)
    }

    private async fetchAllBranchesFromNode(remoteNode: NodeApi.NodeApi) {
        try {
            let branches = await remoteNode.branches()
            for (let branch of branches) {
                try {
                    await this.fetchFromNode(remoteNode, branch)
                }
                catch (err) {
                    console.log(`error when fetchAllBranchesFromNode for node ${remoteNode.name}: ${err}`)
                }
            }
        }
        catch (err) {
            console.log(`error when fetchAllBranchesFromNode for node ${remoteNode.name}: ${err}`)
        }
    }

    private async fetchFromNode(remoteNode: NodeApi.NodeApi, branch: string) {
        let remoteHead = await remoteNode.blockChainHead(branch)

        // fetch the missing parent blocks in node
        let toAddBlocks = []
        let toMaybeFetch = remoteHead
        while (toMaybeFetch) {
            if (await this.node.knowsBlock(toMaybeFetch))
                break

            let addedBlock = (await remoteNode.blockChainBlockData(toMaybeFetch, 1))[0]
            toAddBlocks.push(addedBlock)

            toMaybeFetch = addedBlock.previousBlockId
        }

        // add them to node
        toAddBlocks = toAddBlocks.reverse()
        for (let toAddBlock of toAddBlocks) {
            console.log(`transfer block ${(await Block.idOfBlock(toAddBlock)).substring(0, 5)} from ${remoteNode.name} to ${this.node.name}`)
            await this.node.registerBlock(toAddBlock)
        }
    }
}