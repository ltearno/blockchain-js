import * as NodeImpl from './node-impl'
import * as NodeNetworkClient from './node-network-client'
import * as NodeTransfer from './node-transfer'
import * as MinerImpl from './miner-impl'
import * as ListOnChain from './list-on-chain'
import { NodeApi } from './node-api'
import { NetworkClientApi } from './network-client-api';

export interface Peer {
    address: string
    port: number
}

export interface PeerInfo {
    id: number
    client: NodeNetworkClient.NodeClient
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
    public transfer: NodeTransfer.NodeTransfer
    public miner: MinerImpl.MinerImpl
    public lists: Map<string, ListOnChain.ListOnChain>

    public peerInfos: PeerInfo[] = []

    private nextPeerId = 1

    constructor(private networkClientApi: NetworkClientApi) {
        // node creation
        this.node = new NodeImpl.NodeImpl('original')

        // node peering
        this.transfer = new NodeTransfer.NodeTransfer(this.node)
        this.transfer.initialize([])

        // miner
        this.miner = new MinerImpl.MinerImpl(this.node)

        // list on chain
        this.lists = new Map<string, ListOnChain.ListOnChain>()
    }

    addPeer(peer: Peer) {
        let info: PeerInfo = {
            id: this.nextPeerId++,
            client: new NodeNetworkClient.NodeClient(`remote-node-${peer.address}-${peer.port}`, peer.address, peer.port, this.networkClientApi)
        }

        info.client.initialize()
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