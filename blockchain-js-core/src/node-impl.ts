import * as Block from './block'
import * as NodeApi from './node-api'

export class NodeImpl implements NodeApi.NodeApi {
    // block together with their metadata which are known by the node
    private knownBlocks = new Map<string, Block.BlockMetadata>()
    private knownBlocksData = new Map<string, Block.Block>()

    // history of the blockchain heads by branch
    // at 0 is the oldest,
    // at size-1 is the current
    private headLog: Map<string, string[]> = new Map()

    private listeners: NodeApi.NodeEventListener[] = []

    constructor(public name: string) { }

    private getBranchHead(branch: string) {
        if (!branch || !this.headLog.has(branch))
            return null
        return this.headLog.get(branch)
    }

    async branches(): Promise<string[]> {
        let res = []
        for (let branch of this.headLog.keys())
            res.push(branch)
        return res
    }

    async blockChainHead(branch: string) {
        let headLog = this.getBranchHead(branch)
        if (headLog && headLog.length)
            return headLog[headLog.length - 1]
        return null
    }

    async blockChainHeadLog(branch: string, depth: number): Promise<string[]> {
        let headLog = this.getBranchHead(branch)
        if (headLog)
            return headLog.slice(headLog.length - depth, headLog.length).reverse()
        return null
    }

    async blockChainBlockIds(startBlockId: string, depth: number): Promise<string[]> {
        return Array.from(await this.browseBlockchain(startBlockId, depth)).map(item => item.metadata.blockId)
    }

    async blockChainBlockMetadata(startBlockId: string, depth: number): Promise<Block.BlockMetadata[]> {
        return Array.from(await this.browseBlockchain(startBlockId, depth)).map(item => item.metadata)
    }

    async blockChainBlockData(startBlockId: string, depth: number): Promise<Block.Block[]> {
        return Array.from(await this.browseBlockchain(startBlockId, depth)).map(item => item.block)
    }

    // registers a new block in the collection
    // process block's metadata
    // update head if required (new block is valid and has the longest chain)
    async registerBlock(blockId: string, block: Block.Block): Promise<Block.BlockMetadata> {
        // process block data

        console.log(`[${this.name}] receive block ${(await Block.idOfBlock(block)).substring(0, 5)}`)

        if (!blockId || this.knownBlocksData.has(blockId)) {
            console.log(`[${this.name}] already registered block ${blockId && blockId.substring(0, 5)}`)
            return
        }

        blockId = await Block.idOfBlock(block)

        this.knownBlocksData.set(blockId, block)

        if (!block.branch) {
            console.log(`invalid block ! Aborting registration`)
            return
        }

        // process block metadata

        if (this.knownBlocks.has(blockId)) {
            console.log(`[${this.name}] already registered block ${blockId.substring(0, 5)}`)
            return
        }

        if (!block.previousBlockIds.every(parentBlockId => this.knownBlocks.has(parentBlockId))) {
            // TODO register for later this block
            console.log(`register block ${blockId} for later, waiting for parents`)
            return
        }

        let metadata = await this.processMetaData(blockId, block)
        if (!metadata) {
            console.log("cannot build metadata for block")
            return
        }

        console.log(`new block accepted`)
        this.knownBlocks.set(metadata.blockId, metadata)

        // TODO call metadata processing for waiting blocks

        // TODO move to method maybeUpdateHead, called at the end of meta data processing (but to be optimized so that head doesnt jump one block by one if long run is possible)
        let oldHead = await this.blockChainHead(block.branch)
        if (metadata.isValid && this.compareBlockchains(metadata.blockId, oldHead) > 0) {
            console.log(`new block ${metadata.blockId} is the new head of branch ${block.branch}`)

            this.setHead(block.branch, metadata.blockId)

            // if new head is not a parent of new head (non fast-forward), create a merge block
            if (!this.isAncestorOf(oldHead, metadata.blockId)) {
                // create a merge block
                let pre = Block.createBlock(block.branch, [metadata.blockId, oldHead], ["AUTO MERGE BLOCK"])
                let oldHeadBlock = (await this.blockChainBlockData(oldHead, 1))[0]
                let minedBlock = Block.mineBlock(pre, oldHeadBlock ? Math.max(oldHeadBlock.validityProof.difficulty, block.validityProof.difficulty) : block.validityProof.difficulty)
            }
        }

        return metadata
    }

    private isAncestorOf(ancestorId: string, ofId: string): boolean {
        // from ofId browsing parents, if we encounter ancestorId return true
        // otherwise return false
        let visiteds = new Set<string>()
        let toVisit: string[] = [ofId]
        while (toVisit.length) {
            let visited = toVisit.shift()
            visiteds.add(visited)

            if (visited == ancestorId)
                return true

            let block = this.knownBlocksData.get(visited)

            block && block.previousBlockIds && block.previousBlockIds.forEach(p => toVisit.push(p))
        }

        return false
    }

    addEventListener(type: 'head', eventListener: NodeApi.NodeEventListener): void {
        this.listeners.push(eventListener)

        for (let branch of this.headLog.keys())
            eventListener(branch)
    }

    removeEventListener(eventListener: NodeApi.NodeEventListener): void {
        this.listeners = this.listeners.filter(el => el != eventListener)
    }

    async knowsBlock(id: string): Promise<boolean> {
        return this.knownBlocksData.has(id)
    }

    // TODO : with generic validation, compare the global validation value (pow, pos, other...)
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

        // TODO : use parametrized algorithm for validation and trusting

        // greatest confidence
        if (meta1.confidence > meta2.confidence)
            return 1
        if (meta1.confidence < meta2.confidence)
            return -1

        // greatest number of blocks (maximum diversity)
        if (meta1.blockCount > meta2.blockCount)
            return 1
        if (meta1.blockCount < meta2.blockCount)
            return -1

        // biggest id
        return meta1.blockId.localeCompare(meta2.blockId)
    }

    private setHead(branch: string, blockId: string) {
        if (!blockId || !branch)
            return

        let headLog = this.getBranchHead(branch)
        if (!headLog) {
            headLog = []
            this.headLog.set(branch, headLog)
        }

        headLog.push(blockId)

        console.log(`[${this.name}] new head on branch ${branch} : ${blockId.substring(0, 5)}`)

        this.listeners.forEach(listener => listener(branch))
    }

    /**
     * @param blockId Be careful the blockId must be valid !
     * @param block 
     */
    private async processMetaData(blockId: string, block: Block.Block): Promise<Block.BlockMetadata> {
        let blockCount = 1
        let confidence = 1 * block.validityProof.difficulty

        if (block.previousBlockIds) {
            for (let previousBlockId of block.previousBlockIds) {
                let previousBlockMetadata = this.knownBlocks.get(previousBlockId)
                if (!previousBlockMetadata) {
                    console.log("cannot find the parent block in database, so cannot processMetadata")
                    return null
                }

                blockCount += 1 * previousBlockMetadata.blockCount
                confidence += 1 * previousBlockMetadata.confidence
            }
        }

        // TODO find the process through which difficulty is raised

        let metadata: Block.BlockMetadata = {
            blockId,
            isValid: await Block.isBlockValid(block),
            blockCount,
            confidence
        }

        return metadata
    }

    private *browseBlockchain(startBlockId: string, depth: number) {
        while (startBlockId && depth-- > 0) {
            let metadata = this.knownBlocks.get(startBlockId)
            let block = this.knownBlocksData.get(startBlockId)

            if (!metadata || !block)
                throw "unknown block"

            yield { metadata, block }

            // TODO this only browse first parent, it should browser the entire tree !
            startBlockId = block.previousBlockIds && block.previousBlockIds.length && block.previousBlockIds[0]
        }
    }
}

