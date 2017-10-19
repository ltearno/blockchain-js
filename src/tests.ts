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
    const NB_NODES = 5

    let miner = TestTools.createSimpleMiner(null, 10)

    let nodes: NodeImpl.NodeImpl[] = []
    for (let i = 0; i < NB_NODES; i++)
        nodes.push(new NodeImpl.NodeImpl(`node ${i}`))

    let anyNode = () => nodes[Math.floor(Math.random() * nodes.length)]

    let checkAll = async () => {
        let ok = true
        let head = await nodes[0].blockChainHead()
        for (let i = 1; i < nodes.length; i++) {
            if (head != await nodes[i].blockChainHead()) {
                console.log(`node ${nodes[i].name} has head ${await nodes[i].blockChainHead()} instead of ${head}`)
                ok = false
            }
        }
        if (!ok)
            console.log(`error in checking all blocks`)
    }

    console.log(`mining initial blocks`)
    let initNode = anyNode()
    for (let i = 0; i < 2; i++) {
        await initNode.registerBlock(await miner())
    }

    function fullyConnectedTopology(node, index) { return nodes.filter(n => n != node) }
    function circleTopology(node, index) { return [nodes[(index + 1) % nodes.length]] }

    let topologies = [
        fullyConnectedTopology,
        circleTopology
    ]

    for (let topology of topologies) {
        console.log(`switch to topology ${topology.name}\n`)

        // contexts construction
        let nodeContexts: NodeTransfer.NodeTransfer[] = nodes
            .map((node, index) => new NodeTransfer.NodeTransfer(
                node,
                topology(node, index)
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

        await TestTools.wait(1000)
        await checkAll()

        nodeContexts.forEach(context => context.terminate())
    }
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
        console.log(`\n\n${tester.name}\n`)
        await tester()
    }

    console.log(`done with testing`)
}