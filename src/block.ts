import * as HashTools from './hash-tools'

/**
 * A block which has no validation data yet
 */
export interface BlockSeed {
    // ID of the previous block
    previousBlockId: string

    // a list of data appended to the block. Those are the data users required to be published on the blockchain
    data: any[]
}

/**
 * A block with validity proof information in it
 */
export interface Block extends BlockSeed {
    validityProof: {
        difficulty: number
        padding: number
    }
}

/**
 * Information about a block
 */
export interface BlockMetadata {
    // target block information
    target: Block

    // ID of the block (which is sha(stringify(block)))
    blockId: string

    // sha(stringify(block)) == block.validityProof && block.validityProof >= block.previousBlock.difficulty
    isValid: boolean

    // number of blocks in the chain, including the target block
    chainLength: number
}

export function createBlock(previousBlockId: string, data: any[]): BlockSeed {
    let block: BlockSeed = {
        previousBlockId,
        data
    }

    return block
}

export function isBlockValid(block: Block, minimalDifficulty: number): boolean {
    if (!block || !block.validityProof || block.validityProof.difficulty < minimalDifficulty)
        return false

    let sha = idOfBlock(block)
    return sha.endsWith("" + block.validityProof.difficulty)
}

export function idOfBlock(block: Block) {
    return HashTools.hashString(JSON.stringify(block))
}

export function mineBlock(model: BlockSeed, difficulty: number): Block | null {
    let block: Block = {
        previousBlockId: model.previousBlockId,
        data: model.data
    } as Block

    let padding = 0
    while (true) {
        block.validityProof = {
            difficulty,
            padding
        }

        if (isBlockValid(block, difficulty))
            return block

        padding++
        if (padding == 0)
            return null
    }
}
