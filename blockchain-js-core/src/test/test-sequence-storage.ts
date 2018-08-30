import * as Block from '../block'
import * as NodeApi from '../node-api'
import * as NodeImpl from '../node-impl'
import * as TestTools from '../test-tools'
import * as NodeBrowser from '../node-browser'
import * as SequenceStorage from '../sequence-storage'
import * as MinerImpl from '../miner-impl'

async function test() {
    let node = new NodeImpl.NodeImpl()
    let miner = new MinerImpl.MinerImpl(node)
    let browser = new NodeBrowser.NodeBrowser(node)
    browser.initialise()

    /*browser.waitForBlock('1006d20e3329a9152592d44105ffb6a166cf72e7d5626d39170b2e54a01f6463').then(() => {
        console.log(`YYYYYYYYYYYYYAAAAAAHOU !`)
    })*/

    let sequence = new SequenceStorage.SequenceStorage(node, Block.MASTER_BRANCH, 'maseq', miner, browser)
    sequence.initialise()

    for (let i = 0; i < 100; i++) {
        miner.addData(Block.MASTER_BRANCH, 'hello !')
        await miner.mineData()
    }

    // subscribe to sequence updates
    // push to a sequence

    // check that the sequence correctly matches what has been inserted
    // further : check the same thing on DAG like blockchains

    // in the smart-contract implementation, use Sequence instead of List, so
    // that multiple calls can be made in the same block

    // validate that smart contract works on DAG chains !

    // check everything compiles on browser and node, with the CHat application

    // imagine and create an application for product tracking (buy (quote, validate, order), sell, repair, ...)

    await TestTools.wait(1000)
}

test()