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
    private waitingBlocks = new Map<string, Set<string>>()

    constructor() { }

    private getBranchHead(branch: string) {
        if (!branch || !this.headLog.has(branch))
            return null
        return this.headLog.get(branch)
    }

    get blockMetadataCount() {
        return this.knownBlocks.size
    }

    get blockCount() {
        return this.knownBlocksData.size
    }

    async branches(): Promise<string[]> {
        let res = []
        for (let branch of this.headLog.keys())
            res.push(branch)
        return res
    }

    async blockChainHead(branch: string) {
        return this.blockChainHeadSync(branch)
    }

    private blockChainHeadSync(branch: string) {
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
        console.log(`receive block ${blockId}`)

        if (!blockId || !block) {
            console.error(`invalid block`)
            return null
        }

        if (!block.branch) {
            console.error(`invalid block ! Aborting registration`)
            return null
        }

        if (this.knownBlocksData.has(blockId)) {
            console.log(`already registered block ${blockId && blockId.substring(0, 5)}`)
            return this.knownBlocks.get(blockId)
        }

        let fixedId = await Block.idOfBlock(block)
        if (fixedId != blockId) {
            console.warn(`registering a fixed block ${blockId} ${fixedId}`)
            blockId = fixedId
        }

        if (this.knownBlocksData.has(blockId)) {
            console.log(`already registered block ${blockId && blockId.substring(0, 5)} after processing the id`)
            return this.knownBlocks.get(blockId)
        }

        this.knownBlocksData.set(blockId, block)

        return this.processBlockMetadata(blockId, block)
    }

    private async processBlockMetadata(blockId: string, block: Block.Block) {
        if (this.knownBlocks.has(blockId)) {
            console.log(`already registered block metadata ${blockId.substring(0, 5)}`)
            return
        }

        if (block.previousBlockIds && block.previousBlockIds.length && !block.previousBlockIds.every(parentBlockId => this.knownBlocks.has(parentBlockId))) {
            block.previousBlockIds.forEach(parentBlockId => {
                if (!this.knownBlocks.has(parentBlockId)) {
                    console.log(`${blockId} waits for parent ${parentBlockId}`)
                    this.waitBlock(parentBlockId, blockId)
                }
            })
            return
        }

        let metadata = this.realProcessBlock(blockId, block)

        return metadata
    }

    private waitBlock(waitedBlockId: string, waitingBlockId: string) {
        if (!this.knownBlocksData.has(waitingBlockId)) {
            console.error(`WAITING WITHOUT DATA !`)
            return
        }

        if (this.knownBlocks.has(waitedBlockId)) {
            console.error(`WAITING ALREADY HERE DATA !`)
            return
        }

        if (this.waitingBlocks.has(waitedBlockId)) {
            this.waitingBlocks.get(waitedBlockId).add(waitingBlockId)
        }
        else {
            let waitSet = new Set<string>()
            waitSet.add(waitingBlockId)
            this.waitingBlocks.set(waitedBlockId, waitSet)
        }
    }

    private async wakeupBlocks(blockId: string) {
        if (!this.waitingBlocks.has(blockId))
            return

        if (!this.knownBlocks.has(blockId)) {
            console.error(`waking up without metadata`)
            return
        }

        if (!this.knownBlocksData.has(blockId)) {
            console.error(`waking up without data`)
            return
        }

        this.waitingBlocks.get(blockId).forEach(waitingBlockId => {
            let waitingBlock = this.knownBlocksData.get(waitingBlockId)
            if (!waitingBlockId || !waitingBlock) {
                console.error(`error cannot find block ${waitingBlockId} data triggered by ${blockId}`)
                return
            }

            this.realProcessBlock(waitingBlockId, waitingBlock)
        })
        this.waitingBlocks.delete(blockId)
    }

    private async realProcessBlock(blockId: string, block: Block.Block) {
        let metadata = await this.processMetaData(blockId, block)
        if (!metadata) {
            console.error("cannot build metadata for block")
            return null
        }

        if (blockId != metadata.blockId) {
            console.error(`is someone hacking us ?`)
            return
        }

        this.knownBlocks.set(metadata.blockId, metadata)
        this.wakeupBlocks(metadata.blockId)

        this.maybeUpdateHead(block, metadata)

        return metadata
    }

    private async maybeUpdateHead(block: Block.Block, metadata: Block.BlockMetadata) {
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
            eventListener({ branch, headBlockId: this.blockChainHeadSync(branch) })
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

        console.log(`new head on branch ${branch} : ${blockId.substring(0, 5)}`)

        let event = {
            branch,
            headBlockId: blockId
        }

        this.listeners.forEach(listener => listener(event))
    }

    /**
     * @param blockId Be careful the blockId must be valid !
     * @param block 
     */
    private async processMetaData(blockId: string, block: Block.Block): Promise<Block.BlockMetadata> {
        if (!blockId || !block) {
            console.log(`error cannot find block`)
            return null
        }
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

