import * as HashTools from './hash-tools'

export const MASTER_BRANCH = 'master'

// TODO (not 100% sure) : each data in the bockchain should have a hash and a content (hash is not required to be the hash of the content). there can be only one data for a hash on the chain

/**
 * A block which has no validation data yet
 */
export interface BlockSeed {
    // blockchain branch name
    branch: string

    // TODO : should be an ordered list of parents, to allow fot DAG
    // ID of the previous block
    previousBlockIds: string[]

    // a list of data appended to the block. Those are the data users required to be published on the blockchain
    data: any[]
}

/**
 * A block with validity proof information in it
 */
export interface Block extends BlockSeed {
    validityProof: {
        // TODO : add validation strategy id
        // TODO : the other fields are then specific to each strategy
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
    // TODO replace chain length by confidence
    chainLength: number
}

export function createBlock(branch: string, previousBlockIds: string[], data: any[]): BlockSeed {
    let block: BlockSeed = {
        branch,
        previousBlockIds: previousBlockIds && Array.isArray(previousBlockIds) && previousBlockIds.filter(id => id != null),
        data
    }

    return block
}

export async function isBlockValid(block: Block, minimalDifficulty: number): Promise<boolean> {
    // TODO : delegate to specific strategy specified by the block itself
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
        branch: model.branch,
        previousBlockIds: model.previousBlockIds,
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