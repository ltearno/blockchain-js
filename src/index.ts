import * as Block from './block'
import * as Node from './node'
import * as NodeImpl from './node-impl'

// data structure
// node implementation
// mining
// -> node interaction
// network connection (REST API + WebSocket)
// extract and add data
// implement a chat application

console.log(`creating a node`)
let node = new NodeImpl.NodeImpl()
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

let nodes = [node, new NodeImpl.NodeImpl()]

let nodeContexts: {
    node: Node.NodeAPI
    knownNodes: Node.NodeAPI[]
}[] = []

// contexts constructions
for (let node of nodes) {
    nodeContexts.push({
        node,
        knownNodes: nodes.filter(n => n != node)
    })
}

function nodeHead(node: Node.NodeAPI) {
    let log = node.blockChainHeadLog(1)
    return log && log.length && log[0]
}

function refreshNodeFromNode(node: Node.NodeAPI, remoteNode: Node.NodeAPI) {
    // TODO fuck that
    let impl = node as NodeImpl.NodeImpl

    // fetch the new head id
    let newHead = nodeHead(remoteNode)

    // fetch the missing parent blocks in node
    let toAddBlocks = []
    let toMaybeFetch = newHead
    while (toMaybeFetch) {
        if (impl.knowsBlock(toMaybeFetch))
            break

        let addedBlock = remoteNode.blockChainBlockData(toMaybeFetch, 1)[0]
        toAddBlocks.push(addedBlock)
        toMaybeFetch = addedBlock.previousBlockId
    }

    // add them to node
    toAddBlocks.reverse().forEach(b => node.registerBlock(b))
}

// contexts init
for (let context of nodeContexts) {
    context.knownNodes.forEach(remoteNode => {
        remoteNode.addEventListener('head', () => refreshNodeFromNode(context.node, remoteNode))
        refreshNodeFromNode(context.node, remoteNode)
    })
}

nbToMine = 3
while (nbToMine-- >= 0) {
    console.log(`block creation`)
    let block = Block.createBlock(previousBlockId, [{ nom: "yop" }])
    console.log(`mining block`)
    let minedBlock = Block.mineBlock(block, 1001)
    console.log(`mined : ${JSON.stringify(minedBlock)}`)

    console.log(`adding block to node`)
    let metadata = nodes[1].registerBlock(minedBlock)
    console.log(`added block: ${JSON.stringify(metadata)}`)

    previousBlockId = metadata.blockId
}