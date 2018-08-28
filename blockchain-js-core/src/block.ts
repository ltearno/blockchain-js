import * as HashTools from './hash-tools'
import * as OrderedJson from './ordered-json'
export const MASTER_BRANCH = 'master'

/**
 * A block which has no validation data yet
 */
export interface BlockSeed {
    // blockchain branch name
    branch: string

    // IDs of the previous blocks
    previousBlockIds: string[]

    // a list of data appended to the block. Those are the data users required to be published on the blockchain
    data: any[]
}

export const ProofOfWorkStrategy = 'pow'

/**
 * No validation here !
 */
export interface VoidBlockValidationData {
    strategy: 'void'
}

/**
 * Proof of Work validation algorithm
 */
export interface ProofOfWorkBlockValidationData {
    strategy: typeof ProofOfWorkStrategy

    difficulty: number
    padding: number
}

export type BlockValidationData = VoidBlockValidationData | ProofOfWorkBlockValidationData

/**
 * A block with validity proof information in it
 * 
 * - validity of the block as a whole (mining, pki, ...)
 * - validity of data in the block (data format GUID)
 */
export interface Block extends BlockSeed {
    validityProof: BlockValidationData
}

/**
 * Information about a block
 */
export interface BlockMetadata {
    // ID of the block (which is sha(stringify(block)))
    blockId: string

    // IDs of the previous blocks
    previousBlockIds: string[]

    // sha(stringify(block)) == block.validityProof
    isValid: boolean

    // number of blocks in the chain, including the target block
    blockCount: number

    // sum of all the blocks and sub blocks confidence (given by pow for the moment)
    confidence: number
}

export function createBlock(branch: string, previousBlockIds: string[], data: any[]): BlockSeed {
    let block: BlockSeed = {
        branch,
        previousBlockIds: previousBlockIds && Array.isArray(previousBlockIds) && previousBlockIds.filter(id => id != null),
        data
    }

    return block
}

export async function isBlockValid(block: Block): Promise<boolean> {
    if (!block || !block.validityProof)
        return false

    if (block.validityProof.strategy == ProofOfWorkStrategy) {
        if (block.validityProof.difficulty === undefined || block.validityProof.difficulty < 0)
            return false

        let sha = await idOfBlock(block)
        return sha.startsWith("" + block.validityProof.difficulty)
    }

    return false
}

export async function idOfBlock(block: Block) {
    return idOfData(block)
}

export async function idOfData(data: any) {
    return await HashTools.hashString(serializeBlockData(data))
}

export function blockConfidence(block: Block) {
    if (block && block.validityProof && block.validityProof.strategy == ProofOfWorkStrategy) {
        return Math.max(0, 1 * block.validityProof.difficulty)
    }

    return 0
}

export async function mineBlock(model: BlockSeed, difficulty: number, batchSize: number = -1): Promise<Block> {
    let block: Block = {
        branch: model.branch,
        previousBlockIds: model.previousBlockIds,
        data: model.data
    } as Block

    let padding = 0
    while (true) {
        block.validityProof = {
            strategy: ProofOfWorkStrategy,
            difficulty,
            padding
        }

        if (await isBlockValid(block))
            return block

        padding++

        // have we gone through all the integers ?
        if (padding == 0)
            return null

        if (batchSize > 0 && padding % batchSize == 0)
            await wait(0)
    }
}

/**
 * Almost the same as JSON.stringify().
 * Except that object dumps are totally ordered. No space between elements...
 * 
 * strict json data format (total order between payloads)
 */
export function serializeBlockData(data: any): string {
    return OrderedJson.stringify(data)
}

export function deserializeBlockData(representation: string) {
    return OrderedJson.parse(representation)
}

function wait(duration: number) {
    return new Promise((resolve, reject) => setTimeout(() => resolve(), duration))
}