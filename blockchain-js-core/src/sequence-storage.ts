import * as Block from './block'
import * as NodeApi from './node-api'
import * as NodeBrowser from './node-browser'
import * as MinerApi from './miner-api'
import * as TestTools from './test-tools'

const IS_DEBUG = false

export const SEQUENCE_TAG = 'seq-storage'

export interface SequenceItem<T> {
    tag: typeof SEQUENCE_TAG
    id: string
    items: T[]
}

export interface SequenceChangeListener<T> {
    (items: { blockId: string; items: SequenceItem<T>[] }[]): any
}

/**
 * Stores a list on chain.
 * 
 * Items do not refer on with the other, so it is not possible to know in
 * advance in which order non coordinated adds will be serialized.
 * 
 * One thing is sure : for a block id, there is only one possibility for the list
 */
export class SequenceStorage<T> {
    private ownBrowser: boolean

    private lastKnownHead: string = null

    private changeListeners: SequenceChangeListener<T>[] = []

    constructor(
        private node: NodeApi.NodeApi,
        private branch: string,
        private sequenceId: string,
        private miner: MinerApi.MinerApi,
        private browser: NodeBrowser.NodeBrowser = null) {
        this.ownBrowser = this.browser == null
    }

    initialise() {
        if (!this.browser) {
            this.browser = new NodeBrowser.NodeBrowser(this.node)
        }

        this.node.addEventListener('head', null, event => {
            if (event.branch == this.branch)
                this.updateFromNode()
        })
    }

    terminate() {
        if (this.ownBrowser) {
            this.ownBrowser = null
        }

        this.browser = null
        this.node = null
    }

    setBranch(branch: string) {
        this.branch = branch
        this.updateFromNode()
    }

    addItems(items: T[]) {
        this.miner.addData(this.branch, {
            tag: SEQUENCE_TAG,
            id: this.sequenceId,
            items
        })
    }

    addEventListener(type: 'change', handler: SequenceChangeListener<T>) {
        this.changeListeners.push(handler)
    }

    removeEventListener(handler: SequenceChangeListener<T>) {
        this.changeListeners = this.changeListeners.filter(l => l != handler)
    }

    private updateSequencer = new TestTools.CallSerializer(async () => this.realUpdateFromNode())

    private updateFromNode() {
        IS_DEBUG && console.log(`schedule`)

        this.updateSequencer.pushData()
    }

    private async realUpdateFromNode() {
        IS_DEBUG && console.log(`update from ${this.branch}`)

        let head = await this.node.blockChainHead(this.branch)
        if (head == this.lastKnownHead)
            return

        if (!head) {
            console.error(`null head on branch ${this.branch} when browsing for sequence-storage`)
            return
        }

        IS_DEBUG && console.log(`head is ${head}`)

        this.lastKnownHead = head

        let sequenceItems = []

        await this.browser.browseBlocksReverse(head, blockInfo => {
            //console.log(`block: ${blockInfo.metadata.blockId}, depth=${blockInfo.metadata.blockCount}, confidence=${blockInfo.metadata.confidence}`)

            let items = []

            this.appendSequencePartsFromBlock(blockInfo.block, items)

            sequenceItems.push({ blockId: blockInfo.metadata.blockId, items })
        })

        this.changeListeners.forEach(listener => listener(sequenceItems))
    }

    private appendSequencePartsFromBlock(block: Block.Block, sequenceItems: SequenceItem<T>[]) {
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

            dataItem.items.forEach(item => sequenceItems.push(item as SequenceItem<T>))
        }
    }
}