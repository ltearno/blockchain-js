import * as Block from './block'
import * as NodeApi from './node-api'
import * as BlockStore from './block-store'
import { InMemoryBlockStore } from './block-store-inmemory'

export class NodeImpl implements NodeApi.NodeApi {
    private listeners: Map<string, NodeApi.NodeEventListener<keyof NodeApi.BlockchainEventMap>[]> = new Map()

    constructor(private blockStore: BlockStore.BlockStore = new InMemoryBlockStore()) {
        this.listeners.set('head', [])
        this.listeners.set('block', [])
    }

    get blockMetadataCount() {
        return this.blockStore.blockMetadataCount()
    }

    get blockCount() {
        return this.blockStore.blockCount()
    }

    blockIdsSync(callback: (blockId: string, block: Block.Block) => any) {
        this.blockStore.blockIds(callback)
    }

    async branches(): Promise<string[]> {
        return this.blockStore.getBranches()
    }

    async blockChainHead(branch: string) {
        return this.blockStore.getBranchHead(branch)
    }

    async blockChainBlockIds(startBlockId: string, depth: number): Promise<string[]> {
        return Array.from(await this.browseBlockchainByFirstParent(startBlockId, depth)).map(item => item.metadata.blockId)
    }

    async blockChainBlockMetadata(startBlockId: string, depth: number): Promise<Block.BlockMetadata[]> {
        return Array.from(await this.browseBlockchainByFirstParent(startBlockId, depth)).map(item => item.metadata)
    }

    async blockChainBlockData(startBlockId: string, depth: number): Promise<Block.Block[]> {
        return Array.from(await this.browseBlockchainByFirstParent(startBlockId, depth)).map(item => item.block)
    }

    // registers a new block in the collection
    // process block's metadata
    // update head if required (new block is valid and has the longest chain)
    async registerBlock(blockId: string, block: Block.Block): Promise<Block.BlockMetadata> {
        //console.log(`receive block ${blockId}`)

        if (!blockId || !block || !block.branch) {
            console.error(`invalid block ! Aborting registration`)
            return null
        }

        if (this.blockStore.hasBlockData(blockId)) {
            //console.log(`already registered block ${blockId && blockId.substring(0, 5)}`)
            return this.blockStore.getBlockMetadata(blockId)
        }

        let fixedId = await Block.idOfBlock(block)
        if (fixedId != blockId) {
            console.warn(`skipping a block with wrong advertized id ${blockId} ${fixedId}\n${JSON.stringify(block, null, 4)}`)
            return null
        }

        this.blockStore.setBlockData(blockId, block)

        return this.processBlockMetadata(blockId, block)
    }

    private async processBlockMetadata(blockId: string, block: Block.Block) {
        if (this.blockStore.hasBlockMetadata(blockId)) {
            //console.log(`already registered block metadata ${blockId.substring(0, 5)}`)
            return
        }

        if (block.previousBlockIds && block.previousBlockIds.length && !block.previousBlockIds.every(parentBlockId => this.blockStore.hasBlockMetadata(parentBlockId))) {
            block.previousBlockIds.forEach(parentBlockId => {
                if (!this.blockStore.hasBlockMetadata(parentBlockId)) {
                    //console.log(`${blockId} waits for parent ${parentBlockId}`)
                    this.waitBlock(parentBlockId, blockId)
                }
            })
            return
        }

        let metadata = this.realProcessBlock(blockId, block)

        return metadata
    }

    private waitBlock(waitedBlockId: string, waitingBlockId: string) {
        if (!this.blockStore.hasBlockData(waitingBlockId)) {
            console.error(`WAITING WITHOUT DATA !`)
            return
        }

        if (this.blockStore.hasBlockMetadata(waitedBlockId)) {
            console.error(`WAITING ALREADY HERE DATA !`)
            return
        }

        this.blockStore.registerWaitingBlock(waitingBlockId, waitedBlockId)
    }

    private async maybeWakeupBlocks(blockId: string) {
        if (!this.blockStore.hasBlockMetadata(blockId)) {
            console.error(`waking up without metadata`)
            return
        }

        if (!this.blockStore.hasBlockData(blockId)) {
            console.error(`waking up without data`)
            return
        }

        this.blockStore.browseWaitingBlocksAndForget(blockId, waitingBlockId => {
            let waitingBlock = this.blockStore.getBlockData(waitingBlockId)
            if (!waitingBlockId || !waitingBlock) {
                console.error(`error cannot find block ${waitingBlockId} data triggered by ${blockId}`)
                return
            }

            this.realProcessBlock(waitingBlockId, waitingBlock)
        })
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

        this.blockStore.setBlockMetadata(metadata.blockId, metadata)
        this.maybeWakeupBlocks(metadata.blockId)

        this.maybeUpdateHead(block, metadata)

        this.notifyEvent({
            type: 'block',
            blockId
        })

        return metadata
    }

    private maybeUpdateHead(block: Block.Block, metadata: Block.BlockMetadata) {
        let oldHead = this.blockStore.getBranchHead(block.branch)
        if (metadata.isValid && this.compareBlockchains(metadata.blockId, oldHead) > 0) {
            this.setHead(block.branch, metadata.blockId)
        }
    }

    addEventListener<K extends keyof NodeApi.BlockchainEventMap>(type: K, listener: (event: NodeApi.BlockchainEventMap[K]) => any): void {
        this.listeners.get(type).push(listener)

        switch (type) {
            case 'head':
                for (let branch of this.blockStore.getBranches())
                    listener({ type: 'head', branch, headBlockId: this.blockStore.getBranchHead(branch) })
                break

            case 'block':
                this.blockStore.blockIds(blockId => listener({ type: 'block', blockId }))
                break
        }
    }

    removeEventListener<K extends keyof NodeApi.BlockchainEventMap>(eventListener: NodeApi.NodeEventListener<K>): void {
        for (let type of this.listeners.keys())
            this.listeners.set(type, this.listeners.get(type).filter(el => el != eventListener))
    }

    async knowsBlock(id: string): Promise<boolean> {
        return this.blockStore.hasBlockData(id)
    }

    async knowsBlockAsValidated(id: string): Promise<boolean> {
        return this.blockStore.hasBlockMetadata(id)
    }

    // TODO : with generic validation, compare the global validation value (pow, pos, other...)
    private compareBlockchains(block1Id: string, block2Id: string): number {
        if (block1Id == block2Id)
            return 0
        if (!block1Id)
            return -1
        if (!block2Id)
            return 1

        let meta1 = this.blockStore.getBlockMetadata(block1Id)
        let meta2 = this.blockStore.getBlockMetadata(block2Id)

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

        this.blockStore.setBranchHead(branch, blockId)

        //console.log(`new head on branch ${branch} : ${blockId.substring(0, 5)}`)

        if (!this.lastHeadEvents.has(branch)) {
            this.lastHeadEvents.add(branch)
            this.triggerNotifyHead()
        }
    }

    private lastHeadEvents = new Set<string>()

    private notifyTimeout

    private triggerNotifyHead() {
        if (this.notifyTimeout)
            return

        this.notifyTimeout = setTimeout(() => {
            this.lastHeadEvents.forEach(branch => {
                let headBlockId = this.blockStore.getBranchHead(branch)
                let bm = this.blockStore.getBlockMetadata(headBlockId)
                let blockCount = bm && bm.blockCount

                console.log(`new block ${headBlockId}, depth ${blockCount} is the new head of branch ${branch}`)

                this.listeners.get('head').forEach(listener => listener({
                    type: 'head',
                    branch,
                    headBlockId
                }))
            })
            this.lastHeadEvents.clear()
            this.notifyTimeout = null
        }, 0)
    }

    private notifyEvent<K extends keyof NodeApi.BlockchainEventMap>(event: NodeApi.BlockchainEventMap[K]) {
        this.listeners.get(event.type).forEach(listener => listener(event))
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
        let confidence = Block.blockConfidence(block)

        if (block.previousBlockIds) {
            for (let previousBlockId of block.previousBlockIds) {
                let previousBlockMetadata = this.blockStore.getBlockMetadata(previousBlockId)
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
            previousBlockIds: block.previousBlockIds,
            isValid: await Block.isBlockValid(block),
            blockCount,
            confidence
        }

        return metadata
    }

    private *browseBlockchainByFirstParent(startBlockId: string, depth: number) {
        while (startBlockId && depth-- > 0) {
            let metadata = this.blockStore.getBlockMetadata(startBlockId)
            let block = this.blockStore.getBlockData(startBlockId)

            yield { metadata, block }

            // TODO this only browse first parent, it should browser the entire tree !
            startBlockId = block && block.previousBlockIds && block.previousBlockIds.length && block.previousBlockIds[0]
        }
    }
}
