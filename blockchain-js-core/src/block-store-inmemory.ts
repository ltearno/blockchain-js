import * as Block from './block'
import * as BlockStore from './block-store'

export class MemoryBlockStore implements BlockStore.BlockStore {
    private metadata = new Map<string, Block.BlockMetadata>()
    private data = new Map<string, Block.Block>()

    // history of the blockchain heads by branch
    // at 0 is the oldest,
    // at size-1 is the current
    private headLog: Map<string, string[]> = new Map()

    private waitingBlocks = new Map<string, Set<string>>()

    getBranches() {
        let res = []
        for (let branch of this.headLog.keys())
            res.push(branch)
        return res
    }

    hasBranch(id: string) {
        return this.headLog.has(id)
    }

    getBranch(branch: string) {
        if (!branch || !this.headLog.has(branch))
            return null
        return this.headLog.get(branch)
    }

    getBranchHead(branch: string) {
        let headLog = this.getBranch(branch)
        if (headLog && headLog.length)
            return headLog[headLog.length - 1]
        return null
    }

    setBranchHead(branch: string, blockId: string) {
        let headLog = this.getBranch(branch)
        if (!headLog) {
            headLog = []
            this.headLog.set(branch, headLog)
        }

        headLog.push(blockId)
    }

    blockMetadataCount() {
        return this.metadata.size
    }

    blockCount() {
        return this.data.size
    }

    async blockIds(callback: (blockId: string, block: Block.Block) => any) {
        for (let [blockId, block] of this.data)
            callback(blockId, block)
    }

    hasBlockData(id: string) {
        return this.data.has(id)
    }

    getBlockData(id: string) {
        return this.data.get(id)
    }

    setBlockData(blockId: string, block: Block.Block) {
        this.data.set(blockId, block)
    }

    hasBlockMetadata(id: string): boolean {
        return this.metadata.has(id)
    }

    getBlockMetadata(id: string): Block.BlockMetadata {
        return this.metadata.get(id)
    }

    setBlockMetadata(id: string, metadata: Block.BlockMetadata) {
        this.metadata.set(id, metadata)
    }

    registerWaitingBlock(waitingBlockId: string, waitedBlockId: string) {
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