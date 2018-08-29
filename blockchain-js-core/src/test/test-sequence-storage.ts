import * as Block from '../block'
import * as NodeApi from '../node-api'
import * as NodeImpl from '../node-impl'
import * as TestTools from '../test-tools'

/**
 * Plugged to a node, this class maintains a database on the known blocks.
 * It also index the chain so that it becomes easy to browse the chain 
 * with good performances.
 * 
 * All data coming from the node are duplicated by this class. So a good 
 * idea is to reuse the same instance if multiple chain access are needed.
 */
class BlockchainBrowser {
    constructor(
        private node: NodeApi.NodeApi
    ) { }

    private nodeListener = () => this.updateFromNode()

    initialise() {
        this.node.addEventListener('head', this.nodeListener)
        this.updateFromNode()
    }

    terminate() {
        this.node.removeEventListener(this.nodeListener)
        this.node = undefined
    }

    private async updateFromNode() {
    }
}

async function test() {
    console.log(`creating a node`)
    let node = new NodeImpl.NodeImpl()

    node.addEventListener('head', async () => console.log(`event : node has new head (${await node.blockChainHead(Block.MASTER_BRANCH)})`))

    console.log(`current head: ${await node.blockChainHead(Block.MASTER_BRANCH)}`)
    let miner = TestTools.createSimpleMiner(Block.MASTER_BRANCH, null, 10)

    let nbToMine = 2
    while (nbToMine-- >= 0) {
        let minedBlock = await miner()

        console.log(`adding block to node`)
        let metadata = await node.registerBlock(minedBlock.id, minedBlock.block)
        console.log(`added block: ${JSON.stringify(metadata)}`)
    }

    console.log(`branches: ${await node.branches()}`)
}

test()