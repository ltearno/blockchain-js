import * as Block from './block'
import * as NodeApi from './node-api'
import { start } from 'repl';

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

    /**
     * If the handler returns a Promise, it will be waited for by the 
     * browser before continuing the browsing
     */
    async browseBlocks(startBlockId: string, handler: (blockInfo: BlockInfo) => any) {
        if (!startBlockId)
            return false

        try {
            await this.browseBlockchainDepth(startBlockId, async data => {
                let result = handler(data)
                if (result instanceof Promise)
                    await result
            })


            return true
        }
        catch (error) {
            console.error(`error ${error}`, error)
            return false
        }
    }

    async browseBlocksReverse(startBlockId: string, handler: (blockInfo: BlockInfo) => any) {
        let blockList = []

        try {
            await this.browseBlocks(startBlockId, blockInfo => blockList.push(blockInfo))

            for (let i = blockList.length - 1; i >= 0; i--) {
                let result = handler(blockList[i])
                if (result instanceof Promise)
                    await result
            }

            return true
        }
        catch (error) {
            console.error(`error ${error}`, error)
            return false
        }
    }

    private async getBlockFromNode(blockId: string) {
        let block = (await this.node.blockChainBlockData(blockId, 1))[0]
        let metadata = (await this.node.blockChainBlockMetadata(blockId, 1))[0]

        return { block, metadata }
    }

    private async browseBlockchainDepth(startBlockId: string, callback: (data: { block: Block.Block; metadata: Block.BlockMetadata }) => Promise<any>) {
        let visitedBlocks = new Set<string>()

        let toVisit = [startBlockId]

        while (toVisit.length) {
            let blockId = toVisit.shift()

            if (visitedBlocks.has(blockId))
                continue
            visitedBlocks.add(blockId)

            let data = await this.getBlockFromNode(blockId)
            if (!data || !data.block || !data.metadata)
                throw `no block data/metadata for ${blockId}, aborting browsing`

            if (data.block.previousBlockIds) {
                for (let i = data.block.previousBlockIds.length - 1; i >= 0; i--)
                    toVisit.unshift(data.block.previousBlockIds[i])
            }

            await callback(data)
        }
    }
}