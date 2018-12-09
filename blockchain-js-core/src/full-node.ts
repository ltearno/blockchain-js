import * as NodeApi from './node-api'
import * as NodeImpl from './node-impl'
import * as NodeTransfer from './node-transfer'
import * as MinerImpl from './miner-impl'
import * as MinerApi from './miner-api'
import * as ListOnChain from './list-on-chain'
import * as BlockStore from './block-store'
import * as BlockStoreInMemory from './block-store-inmemory'

export interface Peer {
    address: string
    port: number
    secure?: boolean
    autoReconnect?: number
}

export interface PeerInfo {
    id: number
    description: string
    client: NodeApi.NodeApi
}

/**
 * A node with some additional functionalities :
 * 
 * - mining new blocks
 * - peering with other nodes
 * - lists on chain with branch and name
 */
export class FullNode {
    public node: NodeImpl.NodeImpl
    public blockStore: BlockStore.BlockStore
    public transfer: NodeTransfer.NodeTransfer
    public miner: MinerApi.MinerApi
    public lists: Map<string, ListOnChain.ListOnChain>

    public peerInfos: PeerInfo[] = []

    private nextPeerId = 1

    constructor(miner: MinerApi.MinerApi = undefined, blockStore: BlockStore.BlockStore = undefined) {
        this.blockStore = blockStore || new BlockStoreInMemory.InMemoryBlockStore()

        // node creation
        this.node = new NodeImpl.NodeImpl(this.blockStore)

        // node peering
        this.transfer = new NodeTransfer.NodeTransfer(this.node)
        this.transfer.initialize([])

        // miner
        this.miner = miner || new MinerImpl.MinerImpl(this.node)

        // list on chain
        this.lists = new Map<string, ListOnChain.ListOnChain>()
    }

    addPeer(peer: NodeApi.NodeApi, description: string) {
        let info: PeerInfo = {
            id: this.nextPeerId++,
            description,
            client: peer
        }

        this.transfer.addRemoteNode(info.client)
        this.peerInfos.push(info)

        return info
    }

    removePeer(id) {
        let info = this.peerInfos.find(p => p.id == id)
        if (!info)
            return false

        this.transfer.removeRemoteNode(info.client)
        this.peerInfos = this.peerInfos.filter(p => p != info)

        return true
    }

    getListOnChain(branch: string, listName: string) {
        if (!this.lists.has(branch)) {
            let list = new ListOnChain.ListOnChain(this.node, branch, listName, this.miner)
            list.initialise()
            this.lists.set(branch, list)
        }

        return this.lists.get(branch)
    }
}