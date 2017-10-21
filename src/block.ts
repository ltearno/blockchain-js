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

export async function isBlockValid(block: Block, minimalDifficulty: number): Promise<boolean> {
    if (!block || !block.validityProof || block.validityProof.difficulty < minimalDifficulty)
        return false

    let sha = await idOfBlock(block)
    return sha.endsWith("" + block.validityProof.difficulty)
}

export async function idOfBlock(block: Block) {
    return idOfData(block)
}

export async function idOfData(data: any) {
    return await HashTools.hashString(serializeBlockData(data))
}

export async function mineBlock(model: BlockSeed, difficulty: number): Promise<Block> {
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

        if (await isBlockValid(block, difficulty))
            return block

        padding++
        if (padding == 0)
            return null
    }
}

/**
 * Almost the same as JSON.stringify().
 * Except that object dumps are totally ordered. No space between elements...
 * 
 * strict json data format (total order between payloads)
 */
export function serializeBlockData(data: any): string {
    if (Array.isArray(data))
        return `[${(data as any[]).map(item => serializeBlockData(item)).join(',')}]`

    if (data && typeof data === 'object')
        return `{${Object.getOwnPropertyNames(data)
            .sort()
            .filter(name => data[name] !== undefined)
            .map(name => `"${name}":${serializeBlockData(data[name])}`)}}`

    if (typeof data === 'string')
        return JSON.stringify(data)

    if (typeof data === 'number')
        return JSON.stringify(data)

    if (typeof data === 'boolean')
        return JSON.stringify(data)

    if (data === null)
        return 'null'

    throw `unknown data for serializtion ${JSON.stringify(data)}`
}

export function deserializeBlockData(representation: string) {
    return JSON.parse(representation)
}