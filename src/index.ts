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


let t1 = [false, null, { toto: 5, aa: 'titi' }, false, true, 5, 'toto', { 'none': false }]
let t1ser = Block.serializeBlockData(t1)
console.log(`${JSON.stringify(JSON.parse(t1ser))}`)

console.log(`creating a node`)
let node = new NodeImpl.NodeImpl('original')
node.addEventListener('head', () => console.log(`event : node has new head (${node.currentBlockChainHead()})`))

console.log(`current head: ${node.currentBlockChainHead()}`)

let miner = mineBlocks(null)

let nbToMine = 2
while (nbToMine-- >= 0) {
    let minedBlock = miner.next().value

    console.log(`adding block to node`)
    let metadata = node.registerBlock(minedBlock)
    console.log(`added block: ${JSON.stringify(metadata)}`)
}

function* mineBlocks(previousBlockId: string) {
    while (true) {
        console.log(`block creation`)
        let block = Block.createBlock(previousBlockId, [{ nom: "arnaud" }])

        console.log(`mining block`)
        let minedBlock = Block.mineBlock(block, 1001)

        previousBlockId = Block.idOfBlock(minedBlock)

        console.log(`mined block ${previousBlockId}`)
        yield minedBlock
    }
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
    /*.map(node => new NodeTransfer.NodeTransfer(
        node,
        nodes.filter(n => n != node)
    ))*/
    .map((node, index) => new NodeTransfer.NodeTransfer(
        node,
        [nodes[(index + 1) % nodes.length]]
    ))

// contexts init
nodeContexts.forEach(context => context.initialize())

nbToMine = 1
while (nbToMine-- >= 0) {
    let minedBlock = miner.next().value

    let index = Math.floor(Math.random() * nodes.length)

    console.log(`adding block to node ${index}`)
    let metadata = nodes[index].registerBlock(minedBlock)
}

console.log(`finished`)