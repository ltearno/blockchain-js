import * as Block from './block'
import * as NodeApi from './node-api'
import * as NodeImpl from './node-impl'
import * as NodeTransfer from './node-transfer'

// data structure
// node implementation
// mining
// node interaction
// -> network connection (REST API + WebSocket)
// extract and add data
// implement a chat application
// strict json data format (total order between payloads)

console.log(`creating a node`)
let node = new NodeImpl.NodeImpl('original')
node.addEventListener('head', () => console.log(`event : node has new head (${node.currentBlockChainHead()})`))

console.log(`current head: ${node.currentBlockChainHead()}`)

let nbToMine = 5
let previousBlockId = null

while (nbToMine-- >= 0) {
    console.log(`block creation`)
    let block = Block.createBlock(previousBlockId, [{ nom: "arnaud" }])
    console.log(`mining block`)
    let minedBlock = Block.mineBlock(block, 1001)
    console.log(`mined : ${JSON.stringify(minedBlock)}`)

    console.log(`adding block to node`)
    let metadata = node.registerBlock(minedBlock)
    console.log(`added block: ${JSON.stringify(metadata)}`)

    console.log(`current head: ${node.currentBlockChainHead()}`)

    previousBlockId = metadata.blockId
}


/**
 * Node Interaction
 * 
 * node pumps data from known nodes (it subscribes to head and fetches missing blocks)
 * as node pumps data from other nodes, they refresh their head
 */

let nodes = [node]
for (let i = 0; i < 25; i++)
    nodes.push(new NodeImpl.NodeImpl(`node ${i}`))

// contexts constructions
let nodeContexts: NodeTransfer.NodeTransfer[] = nodes
    .map(node => new NodeTransfer.NodeTransfer(
        node,
        nodes.filter(n => n != node)
    ))

// contexts init
nodeContexts.forEach(context => context.initialize())

nbToMine = 30
while (nbToMine-- >= 0) {
    console.log(`block creation`)
    let block = Block.createBlock(previousBlockId, [{ nom: "yop" }])
    console.log(`mining block`)
    let minedBlock = Block.mineBlock(block, 1001)
    console.log(`mined : ${JSON.stringify(minedBlock)}`)

    console.log(`adding block to node`)
    let index = Math.floor(Math.random() * nodes.length)
    let metadata = nodes[index].registerBlock(minedBlock)
    console.log(`added block: ${JSON.stringify(metadata)}`)

    previousBlockId = metadata.blockId
}

console.log(`finished`)