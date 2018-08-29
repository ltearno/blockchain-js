import * as Block from '../block'
import * as NodeApi from '../node-api'
import * as NodeImpl from '../node-impl'
import * as TestTools from '../test-tools'
import * as NodeBrowser from '../node-browser'

async function test() {
    console.log(`creating a node`)
    let node = new NodeImpl.NodeImpl()

    let browser = new NodeBrowser.NodeBrowser(node)

    console.log(`current head: ${await node.blockChainHead(Block.MASTER_BRANCH)}`)
    let miner = TestTools.createSimpleMiner(Block.MASTER_BRANCH, null, 10)

    let nbToMine = 10
    let browserInitStep = 4
    while (nbToMine-- >= 0) {
        let minedBlock = await miner()
        let metadata = await node.registerBlock(minedBlock.id, minedBlock.block)
        console.log(`added block: ${JSON.stringify(metadata)}`)

        if (nbToMine == browserInitStep) {
            console.log(`initialise browser`)
            browser.initialise()
        }
    }

    console.log(`branches: ${await node.branches()}`)

    await TestTools.wait(1000)

    let head = await node.blockChainHead(Block.MASTER_BRANCH)

    console.log(`sync dump`)
    await browser.browseBlocks(head, data => {
        console.log(`received data ${data.metadata.blockId}`)
    })

    console.log(``)
    console.log(`async dump`)
    await browser.browseBlocks(head, async data => {
        console.log(`received data ${data.metadata.blockId}`)
        await TestTools.wait(250)
    })
}

test()