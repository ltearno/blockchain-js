import * as Block from './block'

export interface HeadChangeEvent {
    type: 'head'
    branch: string
    headBlockId: string
}

export interface AcceptedBlockEvent {
    type: 'block'
    blockId: string
}

export interface NodeApi {
    /**
     * Asks if the node knows a block in memory
     */
    knowsBlock(blockId: string): Promise<boolean>

    branches(): Promise<string[]>

    /**
     * Retrieves the blockchain head block id
     * 
     * TODO:
     * For the moment this represents the 'master' branch shared through consensus accross nodes.
     * We should support having multiple 'branches' with different level of validity and different sharing scopes.
     */
    blockChainHead(branch: string): Promise<string>

    /**
     * Retrieves the blockchain head history at a certain depth
     * at 0 is the most recent
     */
    blockChainHeadLog(branch: string, depth: number): Promise<string[]>

    /**
     * Retrieves the ids of the blocks of a selected part of the blockchain
     */
    blockChainBlockIds(startBlockId: string, depth: number): Promise<string[]>

    /**
     * Retrieves the block metadata of the blocks of a selected part of the blockchain
     */
    blockChainBlockMetadata(startBlockId: string, depth: number): Promise<Block.BlockMetadata[]>

    /**
     * Retrieves the data of the blocks of a selected part of the blockchain
     */
    blockChainBlockData(startBlockId: string, depth: number): Promise<Block.Block[]>

    /**
     * Registers a mined block and update the blockchain head if necessary
     * - check that the block is valid
     * - if valid, and all previous blocks are know, and the new block represents
     *   the longest valid chain, then head is updated
     */
    registerBlock(minedBlockId: string, minedBlock: Block.Block): Promise<Block.BlockMetadata>

    /**
     * Registers an event handler that will be called when the blockchain head changes
     * 
     * TODO register on a specific branch
     */
    addEventListener<K extends keyof BlockchainEventMap>(type: K, listener: NodeEventListener<K>): void

    /**
     * Removes an event listener
     */
    removeEventListener<K extends keyof BlockchainEventMap>(eventListener: NodeEventListener<K>): void
}

export interface BlockchainEventMap {
    'head': HeadChangeEvent
    'block': AcceptedBlockEvent
}

export interface NodeEventListener<K extends keyof BlockchainEventMap> {
    (event: BlockchainEventMap[K]): any
}