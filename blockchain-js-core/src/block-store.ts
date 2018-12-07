import * as Block from './block'

export interface BlockStore {
    blockIds(callback: (blockId: string, block: Block.Block) => any): Promise<void>

    getBranches(): string[]
    getBranchHead(branch: string): string
    setBranchHead(branch: string, blockId: string)

    registerWaitingBlock(waitingBlockId: string, waitedBlockId: string)
    browseWaitingBlocksAndForget(blockId: string, callback: (waitingBlockId) => any): Promise<void>

    blockCount(): number
    blockMetadataCount(): number
    hasBlockData(id: string): boolean
    getBlockData(id: string): Block.Block
    setBlockData(blockId: string, block: Block.Block)
    hasBlockMetadata(id: string): boolean
    getBlockMetadata(id: string): Block.BlockMetadata
    setBlockMetadata(id: string, metadata: Block.BlockMetadata)
}