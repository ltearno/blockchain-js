import * as Block from './block'
import * as FullNode from './full-node'
import * as NetworkClientBrowserImpl from './network-client-browser-impl'
import { wait } from './test-tools';

console.log(`WELCOME TO BLOCKCHAIN-JS ON THE BROWSER !`)

async function run() {
    console.log(`initializing full node`)
    let fullNode = new FullNode.FullNode()

    fullNode.node.addEventListener('head', null, async (info) => console.log(`event : node has new head : ${info.branch} as ${info.headBlockId}`))

    console.log(`mine a hello world data`)
    fullNode.miner.addData(Block.MASTER_BRANCH, "Hello my friend !")

    await wait(5000)

    console.log(`current head: ${await fullNode.node.blockChainHead(Block.MASTER_BRANCH)}`)

    let miner = createSimpleMiner(Block.MASTER_BRANCH, null, 10)
    let nbToMine = 20
    while (nbToMine-- >= 0) {
        let minedBlock = await miner()

        console.log(`adding block to node`)
        let metadata = await fullNode.node.registerBlock(minedBlock.minedBlockId, minedBlock.minedBlock)
        console.log(`added block: ${JSON.stringify(metadata)}`)
    }

    console.log(`branches: ${await fullNode.node.branches()}`)

    console.log(`DUMPING BLOCKCHAIN STATE`)
    for (let branch of await fullNode.node.branches()) {
        console.log(`branch ${branch}`)

        let fetchList = [await fullNode.node.blockChainHead(Block.MASTER_BRANCH)]
        while (fetchList.length) {
            let toFetch = fetchList.shift()

            console.log(`fetching block ${toFetch}`)
            let blockMetadatas = await fullNode.node.blockChainBlockMetadata(toFetch, 1)
            let blockMetadata = blockMetadatas && blockMetadatas[0]
            let blockDatas = await fullNode.node.blockChainBlockData(toFetch, 1)
            let blockData = blockDatas && blockDatas[0]

            console.log(`block metadata : ${JSON.stringify(blockMetadata)}`)
            console.log(`block data : ${JSON.stringify(blockData)}`)

            blockData && blockData.previousBlockIds && blockData.previousBlockIds.forEach(p => fetchList.push(p))
        }
    }
}

run().then(() => console.log(`end !`))

function createSimpleMiner(branch: string, previousBlockId: string, difficulty: number) {
    return async function () {
        let block = Block.createBlock(branch, [previousBlockId], [{ nom: "arnaud" }])

        let minedBlock = await Block.mineBlock(block, difficulty)

        let minedBlockId = await Block.idOfBlock(minedBlock)

        console.log(`mined block ${previousBlockId.substring(0, 5)}`)
        return { minedBlockId, minedBlock }
    }
}