import { Component } from '@angular/core'
import * as Blockchain from 'blockchain-js-core'
import * as PeerToPeer from 'rencontres'

const NETWORK_CLIENT_IMPL = new Blockchain.NetworkClientBrowserImpl()

@Component({
  selector: 'body',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  proposedPseudo = this.guid()
  pseudo = null

  fullNode: Blockchain.FullNode = null
  logs: string[] = []
  state: {
    [key: string]: {
      branch: string
      head: string
      blocks: any[]
    }
  } = { "master": { branch: Blockchain.MASTER_BRANCH, head: null, blocks: [] } }
  p2pBroker: PeerToPeer.PeerToPeerBrokering
  isMining = false

  desiredNbPeers = 3

  selectedTab = 1
  selectedBranch = Blockchain.MASTER_BRANCH

  selectTab(i) {
    this.selectedTab = i
  }

  get branches() {
    return Object.getOwnPropertyNames(this.state)
  }

  knownAcceptedMessages = new Set<string>()

  autoMining = false
  autoMiningIteration = 1
  autoP2P = false

  constructor() {
    this.p2pBroker = new PeerToPeer.PeerToPeerBrokering(`wss://${window.location.hostname}:8999/signal`, (offerId, offerMessage) => {
      if (!this.autoP2P || this.knownAcceptedMessages.has(offerMessage))
        return { accepted: false, message: `i know you` }

      return { accepted: true, message: this.pseudo }
    }, (description, channel) => {
      let counterPartyMessage = description.counterPartyMessage
      this.knownAcceptedMessages.add(counterPartyMessage)
      channel.on('close', () => this.knownAcceptedMessages.delete(counterPartyMessage))

      this.addPeerBySocket(channel, `p2p with ${counterPartyMessage} (as '${this.pseudo}') on channel ${description.offerId.substr(0, 5)}`)
    })
    this.p2pBroker.createSignalingSocket()
    setInterval(() => {
      if (this.autoP2P && this.p2pBroker.ready)
        this.maybeOfferP2PChannel()
    }, 10000)

    this.fullNode = new Blockchain.FullNode(NETWORK_CLIENT_IMPL)

    this.fullNode.node.addEventListener('head', async branch => {
      this.log(`new head on branch ${branch} : ${await this.fullNode.node.blockChainHead(branch)}`)

      let state = {}

      for (let branch of await this.fullNode.node.branches()) {
        let toFetch = await this.fullNode.node.blockChainHead(branch)

        let branchState = {
          branch: branch,
          head: toFetch,
          blocks: []
        }

        let count = 0

        let toFetchs = [toFetch]
        while (toFetchs.length) {
          let fetching = toFetchs.shift()

          let blockMetadatas = await this.fullNode.node.blockChainBlockMetadata(fetching, 1)
          let blockMetadata = blockMetadatas && blockMetadatas[0]
          let blockDatas = await this.fullNode.node.blockChainBlockData(fetching, 1)
          let blockData = blockDatas && blockDatas[0]

          branchState.blocks.push({ blockMetadata, blockData })

          blockData && blockData.previousBlockIds && blockData.previousBlockIds.forEach(b => !toFetchs.some(bid => bid == b) && toFetchs.push(b))

          count++
          if (count > 10)
            break
        }

        state[branch] = branchState
      }

      this.state = state
    })
  }

  setPseudo(pseudo, peerToPeer) {
    this.pseudo = pseudo
    this.autoP2P = peerToPeer
  }

  maybeOfferP2PChannel() {
    if (this.p2pBroker.ready && this.fullNode.peerInfos.length < this.desiredNbPeers) {
      this.offerP2PChannel()
    }

    // todo remove when too much peers ?
    // todo remove unconnected peers ?
  }

  async offerP2PChannel() {
    let offerId = await this.p2pBroker.offerChannel(this.pseudo)
  }

  async mine(message, miningDifficulty) {
    if (this.isMining || message == '' || miningDifficulty <= 0)
      return

    this.isMining = true

    try {
      this.fullNode.miner.addData(this.selectedBranch, { id: this.guid(), author: this.pseudo, message })
      let mineResult = await this.fullNode.miner.mineData(miningDifficulty, 30)
      this.log(`mine result: ${JSON.stringify(mineResult)}`)
    }
    catch (error) {
      this.log(`error mining: ${JSON.stringify(error)}`)
    }
    finally {
      this.isMining = false
    }
  }

  log(message) {
    this.logs.unshift(message)
    if (this.logs.length > 20)
      this.logs.pop()
  }

  toggleAutoP2P() {
    if (this.autoP2P) {
      this.autoP2P = false
    }
    else {
      this.autoP2P = true
      this.maybeOfferP2PChannel()
    }
  }

  toggleAutomine(minedData, miningDifficulty, automineTimer) {
    if (this.autoMining) {
      this.autoMining = false
    }
    else {
      this.autoMining = true

      let action = async () => {
        this.autoMining && await this.mine(`${minedData} - ${this.autoMiningIteration++}`, miningDifficulty)
        if (this.autoMining)
          setTimeout(action, automineTimer)
      }
      action()
    }
  }

  async addPeer(peerHost, peerPort) {
    console.log(`add peer ${peerHost}:${peerPort}`)

    let ws = NETWORK_CLIENT_IMPL.createClientWebSocket(`wss://${peerHost}:${peerPort}/events`)

    this.addPeerBySocket(ws, `direct peer ${peerHost}:${peerPort}`)
  }

  private async addPeerBySocket(ws, description: string) {
    let peerInfo: Blockchain.PeerInfo = null
    let connector = null

    ws.on('open', () => {
      console.log(`peer connected`)

      connector = new Blockchain.WebSocketConnector(this.fullNode.node, ws)

      peerInfo = this.fullNode.addPeer(connector, description)
    })

    ws.on('error', (err) => {
      console.log(`error with peer : ${err}`)
      ws.close()
    })

    ws.on('close', () => {
      connector && connector.terminate()
      connector = null
      this.fullNode.removePeer(peerInfo.id)

      console.log('peer disconnected')
    })
  }

  disconnectPeer(peerInfo) {
    this.fullNode.removePeer(peerInfo.id)
  }

  guid() {
    //'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'
    return 'xxxxxxxxxx'.replace(/[xy]/g, (c) => {
      let r = Math.random() * 16 | 0
      let v = c == 'x' ? r : (r & 0x3 | 0x8)

      return v.toString(16)
    })
  }
}