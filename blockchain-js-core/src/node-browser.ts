import * as Block from './block'
import * as NodeApi from './node-api'

export interface BlockInfo {
    block: Block.Block
    metadata: Block.BlockMetadata
}

/**
 * Plugged to a node, this class maintains a database on the known blocks.
 * It also index the chain so that it becomes easy to browse the chain 
 * with good performances.
 * 
 * All data coming from the node are duplicated by this class. So a good 
 * idea is to reuse the same instance if multiple chain access are needed.
 */
export class NodeBrowser {
    constructor(
        private node: NodeApi.NodeApi
    ) { }

    private store = new Map<string, BlockInfo>()

    private registeredBlockEventListener: NodeApi.NodeEventListener<'block'>

    initialise() {
        this.registeredBlockEventListener = e => this.storeBlock(e.blockId)
        this.node.addEventListener('block', this.registeredBlockEventListener)
    }

    terminate() {
        this.node.removeEventListener(this.registeredBlockEventListener)
        this.node = undefined
    }

    /**
     * If the handler returns a Promise, it will be waited for by the 
     * browser before continuing the browsing
     */
    async browseBlocks(startBlockId: string, handler: (blockInfo: BlockInfo) => any) {
        if (!startBlockId)
            return

        for (let data of this.browseBlockchainDepth(startBlockId)) {
            let result = handler(data)
            if (result instanceof Promise)
                await result
        }
    }

    private async storeBlock(blockId: string) {
        console.log(`block event ${blockId}`)

        let block = (await this.node.blockChainBlockData(blockId, 1))[0]
        let metadata = (await this.node.blockChainBlockMetadata(blockId, 1))[0]

        this.store.set(blockId, { block, metadata })
    }

    private *browseBlockchainDepth(startBlockId: string) {
        let visitedBlocks = new Set<string>()

        let toVisit = [startBlockId]

        while (toVisit.length) {
            let blockId = toVisit.shift()

            if (visitedBlocks.has(blockId))
                continue
            visitedBlocks.add(blockId)

            let data = this.store.get(blockId)
            if (!data) {
                console.warn(`no block data/metadata for ${blockId}, aborting browsing`)
                return
            }

            if (data.block.previousBlockIds) {
                for (let i = data.block.previousBlockIds.length - 1; i >= 0; i--)
                    toVisit.unshift(data.block.previousBlockIds[i])
            }

            yield data
        }
    }
}