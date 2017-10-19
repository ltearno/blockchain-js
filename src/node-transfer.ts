import * as Block from './block'
import * as NodeApi from './node-api'
import * as NodeImpl from './node-impl'

export class NodeTransfer {
    constructor(
        private node: NodeApi.NodeApi,
        private knownNodes: NodeApi.NodeApi[]
    ) { }

    initialize() {
        this.knownNodes.forEach(remoteNode => {
            remoteNode.addEventListener('head', () => this.refreshNodeFromNode(this.node, remoteNode))
            this.refreshNodeFromNode(this.node, remoteNode)
        })
    }

    private async nodeHead(node: NodeApi.NodeApi) {
        let log = await node.blockChainHeadLog(1)
        return log && log.length && log[0]
    }

    private async refreshNodeFromNode(node: NodeApi.NodeApi, remoteNode: NodeApi.NodeApi) {
        // fetch the new head id
        let newHead = await this.nodeHead(remoteNode)

        // fetch the missing parent blocks in node
        let toAddBlocks = []
        let toMaybeFetch = newHead
        while (toMaybeFetch) {
            if (await node.knowsBlock(toMaybeFetch))
                break

            let addedBlock = (await remoteNode.blockChainBlockData(toMaybeFetch, 1))[0]
            toAddBlocks.push(addedBlock)
            toMaybeFetch = addedBlock.previousBlockId
        }

        // add them to node
        toAddBlocks = toAddBlocks.reverse()
        for (let toAddBlock of toAddBlocks) {
            //console.log(`SEND BLOCK ${(node as NodeImpl.NodeImpl).name} to ${(remoteNode as NodeImpl.NodeImpl).name} ${await Block.idOfBlock(toAddBlock)}`)
            await node.registerBlock(toAddBlock)
        }
    }
}