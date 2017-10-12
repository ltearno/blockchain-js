import crypto = require('crypto')

export const EMPTY_PAYLOAD_SHA = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

export function hashString(value: string): string {
    if (value === "")
        return EMPTY_PAYLOAD_SHA

    let hash = crypto.createHash('sha256')
    hash.update(value)
    return hash.digest('hex')
}

interface Block {
    previousBlockId: string // ID of the previous block

    validityProof?: {
        difficulty: number
        padding: number
    },

    data: any[] // a list of data appended to the block. Thos are the data users required to be published on the blockchain
}

interface BlockMetadata {
    target: Block

    blockId: string // ID of the block (which is sha(stringify(block)))

    isValid: boolean // sha(stringify(block)) == block.validityProof && block.validityProof >= block.previousBlock.difficulty
    chainLength: number // number of blocks in the chain, including the target block
}


interface BlockChainNode {
    // the number of data which triggers the creation of a block
    highWaterMarkDataCount: number

    // TODO should also have a timer configuration, to say anyway even if not enough data needs to be published, we still create a block

    // requires the node to publish a data on the blockchain
    // TODO how to get a handle so that asker can check if its data ir added?
    publishData(data: any): void

    // list of the currently connected nodes over the network
    // we'll be able to send to and receive messages from those nodes
    // note that their identity is of no use, because we absolutely trust NOBODY anyway !
    connectedNodes: any[]
}

function createBlock(previousBlockId: string, data: any[]): Block {
    let block: Block = {
        previousBlockId,
        data
    }

    return block
}

function isBlockValid(block: Block, minimalDifficulty: number): boolean {
    if (!block || !block.validityProof || block.validityProof.difficulty < minimalDifficulty)
        return false

    let sha = hashString(JSON.stringify(block))
    return sha.endsWith("" + block.validityProof.difficulty)
}

function mineBlock(model: Block, difficulty: number): Block | null {
    let block: Block = {
        previousBlockId: model.previousBlockId,
        data: model.data
    }

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

console.log(`creation du block`)
let block = createBlock(null, [{ nom: "arnaud" }])

console.log(`minage du block`)
let minedBlock = mineBlock(block, 1001)

console.log(`MINED BLOCK : ${JSON.stringify(minedBlock)}`)