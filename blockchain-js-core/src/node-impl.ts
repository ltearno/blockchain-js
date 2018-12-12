import * as Block from './block'
import * as NodeApi from './node-api'
import * as BlockStore from './block-store'
import * as BlockStoreInMemory from './block-store-inmemory'
import * as MiniObservable from './mini-observable'

const IS_DEBUG = false

interface EventListenerInfo<T extends 'head' | 'block'> {
    listener: NodeApi.NodeEventListener<T>
    options: NodeApi.NodeEventListenerOptionsMap[T]
}

export class NodeImpl implements NodeApi.NodeApi {
    private headListeners: EventListenerInfo<'head'>[] = []
    private blockListeners: EventListenerInfo<'block'>[] = []

    private headEvents = new MiniObservable.SimpleEventEmitter<void>()
    private lastHeadEvents = new Set<string>()
    private blocksToNotify: string[] = []

    constructor(private blockStore: BlockStore.BlockStore = new BlockStoreInMemory.InMemoryBlockStore()) {
        this.headEvents.subscribe(_ => this.notifyAllEvents())
    }

    private async notifyAllEvents() {
        let blocksToNotify = this.blocksToNotify
        this.blocksToNotify = []

        if (this.blockListeners.length) {
            for (let blockId of blocksToNotify) {
                this.notifyEvent({
                    type: 'block',
                    blockId
                })
            }
        }

        let lastHeadEvents = this.lastHeadEvents
        this.lastHeadEvents = new Set()

        for (let branch of lastHeadEvents) {
            let headBlockId = await this.blockStore.getBranchHead(branch)

            console.log(`branch ${branch} : ${headBlockId.substr(0, 7)}`)

            this.notifyEvent({
                type: 'head',
                branch,
                headBlockId
            })
        }
    }

    async blocks(callback: (blockId: string, block: Block.Block) => any) {
        await this.blockStore.blocks(callback)
    }

    async branches(): Promise<string[]> {
        return this.blockStore.getBranches()
    }

    async blockChainHead(branch: string) {
        return this.blockStore.getBranchHead(branch)
    }

    async blockChainBlockIds(startBlockId: string, depth: number): Promise<string[]> {
        return (await this.browseBlockchainByFirstParent(startBlockId, depth, false)).map(item => item.metadata.blockId)
    }

    async blockChainBlockMetadata(startBlockId: string, depth: number): Promise<Block.BlockMetadata[]> {
        return (await this.browseBlockchainByFirstParent(startBlockId, depth, false)).map(item => item.metadata)
    }

    async blockChainBlockData(startBlockId: string, depth: number): Promise<Block.Block[]> {
        return (await this.browseBlockchainByFirstParent(startBlockId, depth, true)).map(item => item.block)
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

        if (await this.blockStore.hasBlockData(blockId)) {
            //console.log(`already registered block ${blockId && blockId.substring(0, 5)}`)
            return await this.blockStore.getBlockMetadata(blockId)
        }

        let fixedId = await Block.idOfBlock(block)
        if (fixedId != blockId) {
            console.warn(`skipping a block with wrong advertized id ${blockId} ${fixedId}\n${JSON.stringify(block, null, 4)}`)
            return null
        }

        await this.blockStore.setBlockData(blockId, block)

        return this.processBlockMetadata(blockId, block)
    }

    private async processBlockMetadata(blockId: string, block: Block.Block) {
        if (!blockId || !block)
            throw `processBlockMetadata received null args`

        if (await this.blockStore.hasBlockMetadata(blockId)) {
            return
        }

        // check we have all the parents, if not add missing parents to wait list
        if (block.previousBlockIds) {
            let isWaitingForParents = false
            for (let parentBlockId of block.previousBlockIds) {
                if (!await this.blockStore.hasBlockMetadata(parentBlockId)) {
                    //console.log(`${blockId} waits for parent ${parentBlockId}`)
                    await this.blockStore.registerWaitingBlock(blockId, parentBlockId)
                    isWaitingForParents = true
                }
            }
            if (isWaitingForParents)
                return
        }

        let metadata = this.realProcessBlock(blockId, block)

        return metadata
    }

    private async maybeWakeupBlocks(blockId: string) {
        if (!await this.blockStore.hasBlockMetadata(blockId)) {
            console.error(`waking up without metadata`)
            return
        }

        if (!await this.blockStore.hasBlockData(blockId)) {
            console.error(`waking up without data`)
            return
        }

        let waitingBlocks = []
        await this.blockStore.browseWaitingBlocksAndForget(blockId, waitingBlockId => {
            waitingBlocks.push(waitingBlockId)
        })

        for (let waitingBlockId of waitingBlocks) {
            let waitingBlock = await this.blockStore.getBlockData(waitingBlockId)
            if (!waitingBlockId || !waitingBlock) {
                console.error(`error cannot find block ${waitingBlockId} data triggered by ${blockId}`)
                return
            }

            await this.realProcessBlock(waitingBlockId, waitingBlock)
        }
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

        IS_DEBUG && console.log(`store metadata for ${metadata.blockId}`);

        await this.blockStore.setBlockMetadata(metadata.blockId, metadata)

        this.blocksToNotify.push(blockId)
        await this.maybeUpdateHead(block, metadata)

        this.headEvents.emit(null)
        //this.notifyAllEvents()

        await this.maybeWakeupBlocks(metadata.blockId)

        return metadata
    }

    private async maybeUpdateHead(block: Block.Block, metadata: Block.BlockMetadata) {
        let oldHead = await this.blockStore.getBranchHead(block.branch)
        if (metadata.isValid && await this.compareBlockchains(metadata.blockId, oldHead) > 0) {
            if (!metadata.blockId || !block.branch)
                return

            this.blockStore.setBranchHead(block.branch, metadata.blockId)

            IS_DEBUG && console.log(`new head on branch ${block.branch} : ${metadata.blockId.substring(0, 5)}`)

            this.lastHeadEvents.add(block.branch)
        }
    }

    async addEventListener<K extends keyof NodeApi.BlockchainEventMap>(type: K, options: NodeApi.NodeEventListenerOptionsMap[K], listener: (event: NodeApi.BlockchainEventMap[K]) => any): Promise<void> {
        let info = { listener, options }

        switch (type) {
            case 'head':
                this.headListeners.push(info)

                for (let branch of await this.blockStore.getBranches())
                    this.notifyHeadEventToListener({ type: 'head', branch, headBlockId: await this.blockStore.getBranchHead(branch) }, info)

                break

            case 'block':
                this.blockListeners.push(info)

                // TODO fix that
                await this.blockStore.blocks(blockId => listener({ type: 'block', blockId }))

                break
        }
    }

    removeEventListener<K extends keyof NodeApi.BlockchainEventMap>(eventListener: NodeApi.NodeEventListener<K>): void {
        this.blockListeners = this.blockListeners.filter(el => el.listener !== eventListener)
        this.headListeners = this.headListeners.filter(el => el.listener !== eventListener)
    }

    async knowsBlock(id: string): Promise<boolean> {
        return this.blockStore.hasBlockData(id)
    }

    async knowsBlockAsValidated(id: string): Promise<boolean> {
        return this.blockStore.hasBlockMetadata(id)
    }

    // TODO : with generic validation, compare the global validation value (pow, pos, other...)
    private async compareBlockchains(block1Id: string, block2Id: string): Promise<number> {
        if (block1Id == block2Id)
            return 0
        if (!block1Id)
            return -1
        if (!block2Id)
            return 1

        let meta1 = await this.blockStore.getBlockMetadata(block1Id)
        let meta2 = await this.blockStore.getBlockMetadata(block2Id)

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

    private notifyEvent(event: NodeApi.NodeEvent) {
        IS_DEBUG && console.log(`notify ${event.type} ${JSON.stringify(event)}`)

        if (event.type == 'block') {
            this.blockListeners.forEach(listener => listener.listener(event))
        }
        else if (event.type == 'head') {
            this.headListeners.forEach(listener => this.notifyHeadEventToListener(event, listener))
        }
    }

    private notifyHeadEventToListener(event: NodeApi.BlockchainEventMap['head'], listener: EventListenerInfo<'head'>) {
        if (!listener.options || !listener.options.branch || listener.options.branch == (event as NodeApi.BlockchainEventMap['head']).branch) {
            listener.listener(event as NodeApi.BlockchainEventMap['head'])
        }
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
                let previousBlockMetadata = await this.blockStore.getBlockMetadata(previousBlockId)
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

    private async browseBlockchainByFirstParent(startBlockId: string, depth: number, fetchBlocks: boolean) {
        let result: { metadata: Block.BlockMetadata; block: Block.Block; }[] = []

        while (startBlockId && depth-- > 0) {
            let metadata = await this.blockStore.getBlockMetadata(startBlockId)
            let block = fetchBlocks ? await this.blockStore.getBlockData(startBlockId) : null

            result.push({ metadata, block })

            // TODO this only browse first parent, it should browser the entire tree !
            startBlockId = metadata && metadata.previousBlockIds && metadata.previousBlockIds.length && metadata.previousBlockIds[0]
        }

        return result
    }
}
