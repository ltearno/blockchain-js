import * as Block from './block'

export interface BlockStore {
    blocks(callback: (blockId: string, block: Block.Block) => any): Promise<void>

    getBranches(): Promise<string[]>
    getBranchHead(branch: string): Promise<string>
    setBranchHead(branch: string, blockId: string): Promise<void>

    registerWaitingBlock(waitingBlockId: string, waitedBlockId: string): Promise<void>
    browseWaitingBlocksAndForget(blockId: string, callback: (waitingBlockId) => any): Promise<void>

    hasBlockData(id: string): Promise<boolean>
    getBlockData(id: string): Promise<Block.Block>
    setBlockData(blockId: string, block: Block.Block)
    hasBlockMetadata(id: string): Promise<boolean>
    getBlockMetadata(id: string): Promise<Block.BlockMetadata>
    setBlockMetadata(id: string, metadata: Block.BlockMetadata)
}