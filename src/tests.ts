import * as Block from './block'
import * as NodeImpl from './node-impl'
import * as NodeTransfer from './node-transfer'
import * as NodeWebServer from './node-web-server'
import * as TestTools from './test-tools'

async function testDataSerialization() {
    let t1 = [false, null, { toto: 5, aa: 'titi' }, false, true, 5, 'toto', { 'none': false }]
    let t1ser = Block.serializeBlockData(t1)
    console.log(`${JSON.stringify(JSON.parse(t1ser))}`)
}

async function testBasicMining() {
    console.log(`creating a node`)
    let node = new NodeImpl.NodeImpl('original')
    node.addEventListener('head', async () => console.log(`event : node has new head (${await node.blockChainHead()})`))

    console.log(`current head: ${await node.blockChainHead()}`)
    let miner = TestTools.createSimpleMiner(null, 10)

    let nbToMine = 2
    while (nbToMine-- >= 0) {
        let minedBlock = await miner()

        console.log(`adding block to node`)
        let metadata = await node.registerBlock(minedBlock)
        console.log(`added block: ${JSON.stringify(metadata)}`)
    }
}

async function testNodeTransfer() {
    let miner = TestTools.createSimpleMiner(null, 10)

    let nodes: NodeImpl.NodeImpl[] = []
    for (let i = 0; i < 200; i++)
        nodes.push(new NodeImpl.NodeImpl(`node ${i}`))

    let anyNode = () => nodes[Math.floor(Math.random() * nodes.length)]

    console.log(`mining initial blocks`)
    let initNode = anyNode()
    for (let i = 0; i < 2; i++) {
        await initNode.registerBlock(await miner())
    }

    // contexts construction
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

    // mine blocks and register them to any of the nodes
    let nbToMine = 100
    while (nbToMine-- >= 0) {
        let minedBlock = await miner()

        let nodeToRegisterBlock = anyNode()

        while (!await nodeToRegisterBlock.knowsBlock(minedBlock.previousBlockId)) {
            console.log(`waiting for block ${minedBlock.previousBlockId} availability on node ${nodeToRegisterBlock.name}`)
            await TestTools.wait(300)
        }

        console.log(`adding block to node ${nodeToRegisterBlock.name}`)
        let metadata = await nodeToRegisterBlock.registerBlock(minedBlock)
    }

    // TODO check that all nodes are synchronized
}

async function testNodeWebServer() {
    let node = new NodeImpl.NodeImpl('original')
    let server = new NodeWebServer.NodeWebServer(9091, node)
    server.initialize()
}

let testers = [
    testDataSerialization,
    testBasicMining,
    testNodeTransfer,
    //testNodeWebServer
]

export async function testAll() {
    for (let tester of testers) {
        console.log(`execute ${tester.name}`)
        await tester()
    }

    console.log(`done with testing`)
}