import * as Block from './block'
import * as NodeApi from './node-api'
import * as NodeBrowser from './node-browser'
import * as MinerImpl from './miner-impl'

export const SEQUENCE_TAG = 'seq-storage'

export interface SequenceItem {
    tag: typeof SEQUENCE_TAG
    id: string
    items: any[]
}

export interface SequenceChangeListener {
    (items: { blockId: string; items: SequenceItem[] }[]): any
}

/**
 * Stores a list on chain.
 * 
 * Items do not refer on with the other, so it is not possible to know in
 * advance in which order non coordinated adds will be serialized.
 * 
 * One thing is sure : for a block id, there is only one possibility for the list
 */
export class SequenceStorage {
    private ownBrowser: boolean

    private lastKnownHead: string = null

    private changeListeners: SequenceChangeListener[] = []

    constructor(
        private node: NodeApi.NodeApi,
        private branch: string,
        private sequenceId: string,
        private miner: MinerImpl.MinerImpl,
        private browser: NodeBrowser.NodeBrowser = null) {
        this.ownBrowser = this.browser == null
    }

    initialise() {
        if (!this.browser) {
            this.browser = new NodeBrowser.NodeBrowser(this.node)
            this.browser.initialise()
        }

        this.node.addEventListener('head', event => {
            if (event.branch == this.branch)
                this.updateFromNode()
        })
    }

    terminate() {
        if (this.ownBrowser) {
            this.browser.terminate()
            this.ownBrowser = null
        }

        this.browser = null
        this.node = null
    }

    addItems(items: any[]) {
        this.miner.addData(this.branch, {
            tag: SEQUENCE_TAG,
            id: this.sequenceId,
            items
        })
    }

    addEventListener(type: 'change', handler: SequenceChangeListener) {
        this.changeListeners.push(handler)
    }

    removeEventListener(handler: SequenceChangeListener) {
        this.changeListeners = this.changeListeners.filter(l => l != handler)
    }

    private async updateFromNode() {
        let head = await this.node.blockChainHead(this.branch)

        if (head == this.lastKnownHead)
            return
        this.lastKnownHead = head

        await this.browser.waitForBlock(head)

        let sequenceItems = []

        await this.browser.browseBlocksReverse(head, blockInfo => {
            //console.log(`block: ${blockInfo.metadata.blockId}, depth=${blockInfo.metadata.blockCount}, confidence=${blockInfo.metadata.confidence}`)
            let items = []

            this.appendSequencePartsFromBlock(blockInfo.block, items)

            sequenceItems.push({ blockId: blockInfo.metadata.blockId, items })
        })

        this.changeListeners.forEach(listener => listener(sequenceItems))
    }

    private appendSequencePartsFromBlock(block: Block.Block, sequenceItems: SequenceItem[]) {
        for (let dataItem of block.data) {
            if (typeof dataItem !== 'object')
                continue

            if (!['tag', 'id', 'items'].every(field => field in dataItem))
                continue

            if (dataItem.tag != SEQUENCE_TAG)
                continue

            if (dataItem.id != this.sequenceId)
                continue

            if (!Array.isArray(dataItem.items))
                continue

            dataItem.items.forEach(item => sequenceItems.push(item as SequenceItem))
        }
    }
}