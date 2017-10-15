import * as Block from './block'
import * as NodeApi from './node-api'

export class NodeImpl implements NodeApi.NodeApi {
    // block together with their metadata which are known by the node
    private knownBlocks = new Map<string, Block.BlockMetadata>()

    // history of the blockchain heads
    // at 0 is the oldest,
    // at size-1 is the current
    private headLog: string[] = []

    private listeners: NodeApi.NodeEventListener[] = []

    constructor(private name: string) { }

    currentBlockChainHead() {
        if (this.headLog && this.headLog.length)
            return this.headLog[this.headLog.length - 1]
        return null
    }

    blockChainHeadLog(depth: number): string[] {
        return this.headLog.reverse()
    }

    blockChainBlockIds(startBlockId: string, depth: number): string[] {
        return Array.from(this.browseBlockchain(startBlockId, depth)).map(metadata => metadata.blockId)
    }

    blockChainBlockMetadata(startBlockId: string, depth: number): Block.BlockMetadata[] {
        return Array.from(this.browseBlockchain(startBlockId, depth))
    }

    blockChainBlockData(startBlockId: string, depth: number): Block.Block[] {
        return Array.from(this.browseBlockchain(startBlockId, depth)).map(metadata => metadata.target)
    }

    // registers a new block in the collection
    // process block's metadata
    // update head if required (new block is valid and has the longest chain)
    registerBlock(block: Block.Block): Block.BlockMetadata {
        let metadata = this.processMetaData(block)
        if (!metadata)
            throw "cannot build metadata for block"

        console.log(`[${this.name}] registered block ${metadata.blockId}`)
        this.knownBlocks.set(metadata.blockId, metadata)

        if (metadata.isValid && this.compareBlockchains(metadata.blockId, this.currentBlockChainHead()) > 0)
            this.setHead(metadata.blockId)

        return metadata
    }

    addEventListener(type: 'head', eventListener: NodeApi.NodeEventListener): void {
        this.listeners.push(eventListener)
    }

    knowsBlock(id: string): boolean {
        return this.knownBlocks.has(id)
    }

    private compareBlockchains(block1Id: string, block2Id: string): number {
        if (block1Id == block2Id)
            return 0
        if (!block1Id)
            return -1
        if (!block2Id)
            return 1

        let meta1 = this.knownBlocks.get(block1Id)
        let meta2 = this.knownBlocks.get(block2Id)

        if (!meta1 || !meta2)
            throw "error, not enough block history"

        // valid is biggest
        if (!meta1.isValid)
            return -1
        if (!meta2.isValid)
            return 1

        // longest chain is biggest
        if (meta1.chainLength > meta2.chainLength)
            return 1
        if (meta1.chainLength < meta2.chainLength)
            return -1

        // bigger id is biggest
        return meta1.blockId.localeCompare(meta2.blockId)
    }

    private setHead(blockId: string) {
        if (!blockId)
            return

        console.log(`[${this.name}] new head : ${blockId}`)

        this.headLog.push(blockId)
        this.listeners.forEach(listener => listener())
    }

    private processMetaData(block: Block.Block): Block.BlockMetadata {
        let currentChainLength = 1
        let minimalDifficulty = 0

        if (block.previousBlockId) {
            let previousBlockMetadata = this.knownBlocks.get(block.previousBlockId)
            if (!previousBlockMetadata)
                throw "cannot find the parent block in database, so cannot processMetadata"

            currentChainLength += previousBlockMetadata.chainLength
            minimalDifficulty = previousBlockMetadata.target.validityProof.difficulty
        }

        // TODO find the process through which difficulty is raised

        let metadata: Block.BlockMetadata = {
            blockId: Block.idOfBlock(block),
            isValid: Block.isBlockValid(block, minimalDifficulty),
            target: block,
            chainLength: currentChainLength
        }

        return metadata
    }

    private *browseBlockchain(startBlockId: string, depth: number) {
        while (startBlockId && depth-- > 0) {
            let metadata = this.knownBlocks.get(startBlockId)
            if (!metadata)
                throw "unknown block"

            yield metadata

            startBlockId = metadata.target.previousBlockId
        }
    }
}

