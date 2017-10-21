import * as Block from './block'
import * as NodeApi from './node-api'

export class NodeTransfer {
    private listeners: any[] = undefined

    constructor(
        private node: NodeApi.NodeApi,
        private knownNodes: NodeApi.NodeApi[]
    ) { }

    initialize() {
        this.listeners = []
        this.knownNodes.forEach(remoteNode => {
            let listener = () => {
                console.log(`[${this.node.name}] receive head change from ${remoteNode.name}`)
                this.fetchFromNode(remoteNode)
            }

            remoteNode.addEventListener('head', listener)

            this.listeners.push(listener)

            this.fetchFromNode(remoteNode)
        })
    }

    terminate() {
        this.knownNodes.forEach((remoteNode, index) => remoteNode.removeEventListener(this.listeners[index]))
        this.listeners = undefined
        this.node = undefined
        this.knownNodes = undefined
    }

    private async fetchFromNode(remoteNode: NodeApi.NodeApi) {
        // TODO if we are already fetching from this node, cancel the current fetching before
        // TODO in other words : do it another way (maintain incremental information about remote nodes)

        let remoteHead = await remoteNode.blockChainHead()

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