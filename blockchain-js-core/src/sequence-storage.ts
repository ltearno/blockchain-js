import * as Block from './block'
import * as NodeApi from './node-api'
import * as NodeBrowser from './node-browser'
import * as MinerImpl from './miner-impl'

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

    private async updateFromNode() {
        let head = await this.node.blockChainHead(this.branch)
        if (head == this.lastKnownHead)
            return

        await this.browser.waitForBlock(head)

        this.browser.browseBlocks(head, blockInfo => {
            console.log(`block: ${blockInfo.metadata.blockId}, depth=${blockInfo.metadata.blockCount}, confidence=${blockInfo.metadata.confidence}`)
        })
    }
}