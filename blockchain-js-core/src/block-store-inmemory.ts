import * as Block from './block'
import * as BlockStore from './block-store'

export class InMemoryBlockStore implements BlockStore.BlockStore {
    private metadata = new Map<string, Block.BlockMetadata>()
    private data = new Map<string, Block.Block>()
    private headLog: Map<string, string> = new Map()

    private waitingBlocks = new Map<string, Set<string>>()

    async getBranches() {
        let res = []
        for (let branch of this.headLog.keys())
            res.push(branch)
        return res
    }

    async hasBranch(id: string) {
        return this.headLog.has(id)
    }

    async getBranchHead(branch: string) {
        return await this.headLog.get(branch)
    }

    async setBranchHead(branch: string, blockId: string) {
        this.headLog.set(branch, blockId)
    }

    async blockMetadataCount() {
        return this.metadata.size
    }

    async blockCount() {
        return this.data.size
    }

    async blocks(callback: (blockId: string, block: Block.Block) => any) {
        for (let [blockId, block] of this.data)
            callback(blockId, block)
    }

    async hasBlockData(id: string) {
        return this.data.has(id)
    }

    async getBlockData(id: string) {
        return this.data.get(id)
    }

    async setBlockData(blockId: string, block: Block.Block) {
        this.data.set(blockId, block)
    }

    async hasBlockMetadata(id: string) {
        return this.metadata.has(id)
    }

    async getBlockMetadata(id: string) {
        return this.metadata.get(id)
    }

    async setBlockMetadata(id: string, metadata: Block.BlockMetadata) {
        this.metadata.set(id, metadata)
    }

    async registerWaitingBlock(waitingBlockId: string, waitedBlockId: string) {
        if (this.waitingBlocks.has(waitedBlockId)) {
            this.waitingBlocks.get(waitedBlockId).add(waitingBlockId)
        }
        else {
            let waitSet = new Set<string>()
            waitSet.add(waitingBlockId)
            this.waitingBlocks.set(waitedBlockId, waitSet)
        }
    }

    async browseWaitingBlocksAndForget(blockId: string, callback: (waitingBlockId) => any) {
        if (!this.waitingBlocks.has(blockId))
            return

        this.waitingBlocks.get(blockId).forEach(callback)
        this.waitingBlocks.delete(blockId)
    }
}