import * as Block from './block'

interface MinerAPI {
    /**
     * Registers a data for mining
     * TODO : find a way to order data in a block so that there cannot be two valid blocks
     * with the same data (not same order).
     */
    addData(data: any): void

    /**
     * Mine a block containing all added data
     */
    mineBlock(previousBlockId: string, difficulty: number): Block.Block
}