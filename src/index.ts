import * as Block from './block'
import * as Node from './node'
import * as NodeImpl from './node-impl'

console.log(`creation du block`)
let block = Block.createBlock(null, [{ nom: "arnaud" }])

console.log(`minage du block`)
let minedBlock = Block.mineBlock(block, 1001)

console.log(`MINED BLOCK : ${JSON.stringify(minedBlock)}`)

let node = new NodeImpl.NodeImpl()
node.addEventListener('head', () => console.log(`new head !`))
console.log(`current head: ${node.currentBlockChainHead()}`)
let metadata = node.registerBlock(minedBlock)
console.log(`added block: ${JSON.stringify(metadata)}`)
console.log(`current head: ${node.currentBlockChainHead()}`)