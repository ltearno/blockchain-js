import * as Block from './block'
import * as NodeApi from './node-api'
import * as NodeImpl from './node-impl'
import * as NodeTransfer from './node-transfer'
import * as NodeNetwork from './node-network'
import * as TestTools from './test-tools'

import * as express from 'express'
import * as bodyParser from 'body-parser'
import * as WebSocket from 'ws'

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
    const USE_NETWORK = false
    const NETWORK_BASE_PORT = 10000
    const NB_NODES = 20
    const DIFFICULTY = 2
    const NB_MINED_BLOCKS_INITIAL = 10
    const NB_MINED_BLOCKS_EACH_TOPOLOGY = 10

    let miner = TestTools.createSimpleMiner(null, DIFFICULTY)

    let nodes: NodeApi.NodeApi[] = []
    for (let i = 0; i < NB_NODES; i++) {
        let node: NodeApi.NodeApi = new NodeImpl.NodeImpl(`node ${i}`)

        if (USE_NETWORK) {
            let port = NETWORK_BASE_PORT + i
            let server = new NodeNetwork.NodeServer(port, node)
            server.initialize()

            let proxy = new NodeNetwork.NodeClient(`nodeproxy ${i}`, 'localhost', port)
            proxy.initialize()

            node = proxy
        }

        nodes.push(node)
    }

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
    for (let i = 0; i < NB_MINED_BLOCKS_INITIAL; i++) {
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
        let nbToMine = NB_MINED_BLOCKS_EACH_TOPOLOGY
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

async function testNodeProxy() {
    let server = new NodeNetwork.NodeServer(9000, {
        name: 'debug',
        knowsBlock: (blockId) => {
            console.log(`knowsBlock( ${blockId}`)
            return Promise.resolve(false)
        },
        blockChainHead: () => {
            console.log(`bch`)
            return Promise.resolve(null)
        },
        blockChainHeadLog: (depth) => {
            return Promise.resolve([])
        },
        blockChainBlockIds: (blockId, depth) => {
            return Promise.resolve([])
        },
        blockChainBlockMetadata: (blockId, depth) => {
            return Promise.resolve([])
        },
        blockChainBlockData: (blockId, depth) => {
            return Promise.resolve([])
        },
        registerBlock: async block => {
            console.log(`register block ${(await Block.idOfBlock(block)).substring(0, 5)} : ${JSON.stringify(block)}`)
            console.log(`*** it should be the same as the created one ***`)
            return null
        },
        addEventListener: (type, listener) => {
            console.log(`addListener`)
            setInterval(() => listener(), 1000)
        },
        removeEventListener: (listener) => {
            console.log(`removeListener`)
        }
    })
    server.initialize()

    let proxy = new NodeNetwork.NodeClient('debug-proxy', 'localhost', 9000)
    proxy.initialize()

    let miner = TestTools.createSimpleMiner(null, 3)
    let block = await miner()
    let id = await Block.idOfBlock(block)
    console.log(`created ${id} : ${JSON.stringify(block)}`)
    let metadata = await proxy.registerBlock(block)
    proxy.addEventListener('head', () => console.log(`receive head change`))
}

async function firstTest() {
    let app = express()

    let expressWs = require('express-ws')(app)

    app.use(bodyParser.json())

    app.ws('/events', (ws, req) => {
        // TODO close the listener sometime
        ws.on('message', data => {
            console.log(`rcv: ${JSON.stringify(data)}`)
        })
        setTimeout(() => ws.send(JSON.stringify({ type: 'heartbeat' })), 1000)
        ws.send(JSON.stringify({ type: 'hello' }))
    })

    app.listen(9000, () => console.log(`listening http on port 9000`))
}

let testers = [
    //firstTest,
    //testNodeProxy,
    //testDataSerialization,
    //testBasicMining,
    testNodeTransfer
]

export async function testAll() {
    for (let tester of testers) {
        console.log(`\n\n${tester.name}\n`)
        await tester()
    }

    console.log(`done with testing`)
}