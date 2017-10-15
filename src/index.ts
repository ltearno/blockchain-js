import * as Block from './block'
import * as Node from './node'
import * as NodeImpl from './node-impl'

console.log(`creating a node`)
let node = new NodeImpl.NodeImpl()
node.addEventListener('head', () => console.log(`event : node has new head (${node.currentBlockChainHead()})`))

console.log(`current head: ${node.currentBlockChainHead()}`)

let nbToMine = 5
let previousBlock = null

while (nbToMine-- >= 0) {
    console.log(`block creation`)
    let block = Block.createBlock(null, [{ nom: "arnaud" }])
    console.log(`mining block`)
    let minedBlock = Block.mineBlock(block, 1001)
    console.log(`mined : ${JSON.stringify(minedBlock)}`)

    console.log(`adding block to node`)
    let metadata = node.registerBlock(minedBlock)
    console.log(`added block: ${JSON.stringify(metadata)}`)

    console.log(`current head: ${node.currentBlockChainHead()}`)

    previousBlock = block
}