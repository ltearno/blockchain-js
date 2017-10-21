import * as Block from './block'
import * as NodeApi from './node-api'
import * as NodeImpl from './node-impl'
import * as NodeTransfer from './node-transfer'
import * as NodeNetwork from './node-network'
import * as TestTools from './test-tools'
import * as Tools from './tools'

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
            let app = Tools.createExpressApp(port)
            let server = new NodeNetwork.NodeServer(node)
            server.initialize(app)

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

        // transfer contexts creation
        let nodeContexts: NodeTransfer.NodeTransfer[] = nodes.map(node => new NodeTransfer.NodeTransfer(node))
        nodeContexts.forEach((context, index) => context.initialize(topology(context.node, index)))

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
    let server = new NodeNetwork.NodeServer({
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
    let app = Tools.createExpressApp(9000)
    server.initialize(app)

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
    let node = new NodeImpl.NodeImpl('alone')
    let list = new BCList(node, 'main')
    list.initialise()

    list.addListener(items => console.log(`list: ${JSON.stringify(items)}`))

    let miner = TestTools.createSimpleMiner(null, 3)
    for (let i = 0; i < 3; i++) {
        let block = await miner()
        await node.registerBlock(block)
    }

    for (let i = 0; i < 10; i++) {
        await list.addToList('hello')
        await TestTools.wait(10)
        await list.addToList('world')
        await list.addToList('funky pop !!!')
    }
}

let testers = [
    firstTest,
    //testNodeProxy,
    //testDataSerialization,
    //testBasicMining,
    //testNodeTransfer
]

export async function testAll() {
    for (let tester of testers) {
        console.log(`\n\n${tester.name}\n`)
        await tester()
    }

    console.log(`done with testing`)
}

/*
Tu connais un NodeApi
Tu veux put et get des data : une liste chainee
=> liste chainee (nommée) de données, tout le monde peut lire/ecrire, chargement async depuis la blockchain
*/

// those things are added into the blocks' data in the blockchain
interface BCListItem {
    tag: 'DUMMY_LINKED_LIST'
    listName: string
    previousListItemData: string
    items: any[]

    // TODO optimise : memorize the id of the last block containing list data
    // TODO improve : add signing and RW rights (root rights assigned to list creator ?)
}

export class BCList {
    constructor(private node: NodeApi.NodeApi, private listName: string) { }

    private blocks = new Map<string, Block.BlockMetadata>()

    private listItems: BCListItem[]
    private dataList: any[]

    private updating = false
    private queueUpdate = false

    private listeners: { (list): void }[] = []

    initialise() {
        this.node.addEventListener('head', () => this.updateFromNode())
        this.updateFromNode()
    }

    getList(): any[] {
        return this.dataList
    }

    addListener(listener: (list: any[]) => void) {
        this.listeners.push(listener)
    }

    async addToList(data: any) {
        let head = await this.node.blockChainHead()
        let difficuly = 10
        if (head) {
            let metadata = (await this.node.blockChainBlockMetadata(head, 1))[0]
            difficuly = metadata.target.validityProof.difficulty
        }

        let newItem: BCListItem = {
            tag: 'DUMMY_LINKED_LIST',
            listName: this.listName,
            previousListItemData: await this.lastListItemId(this.listItems),
            items: [data]
        }

        let preBlock = Block.createBlock(head, [newItem])
        let block = await Block.mineBlock(preBlock, difficuly)

        await this.node.registerBlock(block)
    }

    private async updateFromNode() {
        if (this.updating) {
            this.queueUpdate = true
            return
        }

        this.updating = true

        let previousLastListItemId = await this.lastListItemId(this.listItems)

        try {
            let head = await this.node.blockChainHead()
            this.listItems = await this.fetchListItemsFromBlockchain(head)
            this.dataList = []
            for (let listItem of this.listItems)
                this.dataList = this.dataList.concat(listItem.items)
        }
        catch (error) {
            console.log(`update error : ${error}`)
        }

        this.updating = false

        let currentLastListItemId = await this.lastListItemId(this.listItems)

        if (previousLastListItemId != currentLastListItemId)
            this.listeners.forEach(listener => listener(this.dataList))

        if (this.queueUpdate) {
            this.queueUpdate = false
            this.updateFromNode()
        }
    }

    private async fetchListItemsFromBlockchain(blockId: string): Promise<BCListItem[]> {
        if (!blockId)
            return []

        let metadata = this.blocks.get(blockId)
        if (!metadata)
            metadata = (await this.node.blockChainBlockMetadata(blockId, 1))[0]
        if (!metadata)
            throw `impossible to retrieve block`

        let firstPart = await this.fetchListItemsFromBlockchain(metadata.target.previousBlockId)
        let lastDataId = await this.lastListItemId(firstPart)

        let lastPart = await this.findListPartInBlock(metadata.target, lastDataId)
        return firstPart.concat(lastPart)
    }

    private async lastListItemId(list: BCListItem[]) {
        if (list && list.length)
            return await Block.idOfData(list[list.length - 1])
        return null
    }

    private async findListPartInBlock(block: Block.Block, lastItemData: string): Promise<BCListItem[]> {
        let part: BCListItem[] = []

        for (let dataItem of block.data) {
            if (typeof dataItem !== 'object')
                continue
            if (!['tag', 'listName', 'previousListItemData', 'items'].every(field => field in dataItem))
                continue

            if (dataItem.tag != 'DUMMY_LINKED_LIST')
                continue

            if (dataItem.listName != this.listName)
                continue

            if (dataItem.previousListItemData != lastItemData)
                continue

            if (!Array.isArray(dataItem.items))
                continue

            part.push(dataItem)
            lastItemData = await Block.idOfData(dataItem)
        }

        return part
    }

    // Phases : begins by Reading
    // - Reading : read all blocks from node's head to construct the list from root
    // - Updating : each time the head moves, read the blocks and update the list (take care of if some items where on a block that has dissapeared)

    // TODO : identify the write operation so that one can wait on it
    // we can know that a tx is accepted when a new confirmed block will contain the written record
    // we can know that a tx is not confirmed when a new confirmed block will contain new records on the list and not the written record

    // READING :
    // subscribe to the node => fetch latest data
    // reverse browser the node's head and fetch blocks until root block
    // browser blocks from root and filter list data, construct the chained list with that
}