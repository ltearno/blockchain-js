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

    private store = new Map<string, BlockInfo>()

    private registeredBlockEventListener: NodeApi.NodeEventListener<'block'>

    private waitedBlocks = new Map<string, { (): void }[]>()

    initialise() {
        this.registeredBlockEventListener = e => this.storeBlock(e.blockId)
        this.node.addEventListener('block', this.registeredBlockEventListener)
    }

    terminate() {
        this.node.removeEventListener(this.registeredBlockEventListener)
        this.node = undefined
    }

    waitForBlock(blockId: string): Promise<any> {
        if (this.store.has(blockId))
            return Promise.resolve(true)

        return new Promise((resolve) => {
            if (this.store.has(blockId)) {
                resolve()
                return
            }

            if (this.waitedBlocks.has(blockId))
                this.waitedBlocks.get(blockId).push(resolve)
            else
                this.waitedBlocks.set(blockId, [resolve])
        })
    }

    private maybeNotifyWaitedBlocks(blockId: string) {
        let waitingResolvers = this.waitedBlocks.get(blockId)
        waitingResolvers && waitingResolvers.forEach(resolver => resolver())

        // nobody will ever wait for it because we have it now !
        this.waitedBlocks.delete(blockId)
    }

    /**
     * If the handler returns a Promise, it will be waited for by the 
     * browser before continuing the browsing
     */
    async browseBlocks(startBlockId: string, handler: (blockInfo: BlockInfo) => any) {
        if (!startBlockId)
            return false

        try {
            for (let data of this.browseBlockchainDepth(startBlockId)) {
                let result = handler(data)
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

    private async storeBlock(blockId: string) {
        let block = (await this.node.blockChainBlockData(blockId, 1))[0]
        let metadata = (await this.node.blockChainBlockMetadata(blockId, 1))[0]

        this.store.set(blockId, { block, metadata })

        this.maybeNotifyWaitedBlocks(blockId)
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
            if (!data)
                throw `no block data/metadata for ${blockId}, aborting browsing`

            if (data.block.previousBlockIds) {
                for (let i = data.block.previousBlockIds.length - 1; i >= 0; i--)
                    toVisit.unshift(data.block.previousBlockIds[i])
            }

            yield data
        }
    }
}