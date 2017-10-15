import * as Block from './block'

export interface NodeEventListener {
    (): void
}

export interface NodeAPI {
    /**
     * Retrieves the blockchain head history at a certain depth
     * at 0 is the most recent
     */
    blockChainHeadLog(depth: number): string[]

    /**
     * Retrieves the ids of the blocks of a selected part of the blockchain
     */
    blockChainBlockIds(startBlockId: string, depth: number): string[]

    /**
     * Retrieves the block metadata of the blocks of a selected part of the blockchain
     */
    blockChainBlockMetadata(startBlockId: string, depth: number): Block.BlockMetadata[]

    /**
     * Retrieves the data of the blocks of a selected part of the blockchain
     */
    blockChainBlockData(startBlockId: string, depth: number): Block.Block[]

    /**
     * Registers a mined block and update the blockchain head if necessary
     * - check that the block is valid
     * - if valid, and all previous blocks are know, and the new block represents
     *   the longest valid chain, then head is updated
     */
    registerBlock(minedBlock: Block.Block): Block.BlockMetadata

    /**
     * Registers an event handler that will be called when the blockchain head changes
     */
    addEventListener(type: 'head', eventListener: NodeEventListener): void
}