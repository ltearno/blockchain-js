import * as Block from '../block'
import * as NodeImpl from '../node-impl'
import * as MinerImpl from '../miner-impl'
import * as KeyValueStorage from '../key-value-storage'
import * as TestTools from '../test-tools'

async function main() {
    let node = new NodeImpl.NodeImpl()
    let miner = new MinerImpl.MinerImpl(node)

    for (let j = 0; j < 5; j++) {
        for (let i = 0; i < 3; i++) {
            let data = { "v": `${j} - ${i}` }
            data[`v-${i}-${j}`] = i * j
            miner.addData(Block.MASTER_BRANCH, { tag: 'kvs-test-storage', items: data })
        }
        await miner.mineData()

        await TestTools.wait(100)
    }

    let keyValueStorage = new KeyValueStorage.KeyValueStorage(node, Block.MASTER_BRANCH, "test-storage", miner)
    keyValueStorage.initialise()

    console.log(`real beginning`)

    await miner.mineData()
}

main()