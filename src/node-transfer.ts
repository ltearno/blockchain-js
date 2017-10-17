import * as Block from './block'
import * as NodeApi from './node-api'

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

    private nodeHead(node: NodeApi.NodeApi) {
        let log = node.blockChainHeadLog(1)
        return log && log.length && log[0]
    }

    private refreshNodeFromNode(node: NodeApi.NodeApi, remoteNode: NodeApi.NodeApi) {
        // fetch the new head id
        let newHead = this.nodeHead(remoteNode)

        // fetch the missing parent blocks in node
        let toAddBlocks = []
        let toMaybeFetch = newHead
        while (toMaybeFetch) {
            if (node.knowsBlock(toMaybeFetch))
                break

            let addedBlock = remoteNode.blockChainBlockData(toMaybeFetch, 1)[0]
            toAddBlocks.push(addedBlock)
            toMaybeFetch = addedBlock.previousBlockId
        }

        // add them to node
        toAddBlocks.reverse().forEach(b => node.registerBlock(b))
    }
}