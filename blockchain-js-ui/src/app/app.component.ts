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
  title = guid()
  fullNode: Blockchain.FullNode = null
  logs: string[] = []
  state = []
  p2pBroker: PeerToPeer.PeerToPeerBrokering
  isMining = false

  desiredNbPeers = 3

  knownAcceptedMessages = new Set<string>()

  autoMining = false
  autoMiningIteration = 1
  autoP2P = false

  constructor() {
    this.p2pBroker = new PeerToPeer.PeerToPeerBrokering(`ws://${window.location.hostname}:8999/signal`, (offerId, offerMessage) => {
      if (this.knownAcceptedMessages.has(offerMessage))
        return { accepted: false, message: `i know you` }

      console.log(`OFFER ${offerId}, ${offerMessage}`)

      return { accepted: true, message: this.title }
    }, (description, channel) => {
      let counterPartyMessage = description.counterPartyMessage
      this.knownAcceptedMessages.add(counterPartyMessage)
      channel.on('close', () => this.knownAcceptedMessages.delete(counterPartyMessage))

      this.addPeerBySocket(channel, `p2p with ${counterPartyMessage} (as '${this.title}') on channel ${description.offerId.substr(0, 5)}`)
    })
    this.p2pBroker.createSignalingSocket()
    setInterval(() => {
      if (this.autoP2P && this.p2pBroker.ready)
        this.maybeOfferP2PChannel()
    }, 10000)

    this.fullNode = new Blockchain.FullNode(NETWORK_CLIENT_IMPL)
    console.log(`full node created`)

    this.fullNode.node.addEventListener('head', async branch => {
      this.log(`new head on branch ${branch} : ${await this.fullNode.node.blockChainHead(branch)}`)

      let state = []

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

        state.push(branchState)
      }

      this.state = state
    })
  }

  maybeOfferP2PChannel() {
    if (this.p2pBroker.ready && this.fullNode.peerInfos.length < this.desiredNbPeers) {
      this.offerP2PChannel()
    }

    // todo remove when too much peers ?
    // todo remove unconnected peers ?
  }

  async offerP2PChannel() {
    let offerId = await this.p2pBroker.offerChannel(this.title)
  }

  async mine(minedData, miningDifficulty) {
    if (this.isMining && minedData == '' || miningDifficulty <= 0)
      return

    this.isMining = true

    try {
      this.fullNode.miner.addData(Blockchain.MASTER_BRANCH, minedData)
      let mineResult = await this.fullNode.miner.mineData(miningDifficulty, 30)
      this.log(`mine result: ${JSON.stringify(mineResult)}`)
    }
    catch (error) {
      this.log(`error mining: ${JSON.stringify(error)}`)
      throw error
    }
    finally {
      this.isMining = false
    }
  }

  log(message) {
    this.logs.unshift(message)
    if (this.logs.length > 50)
      this.logs.splice(20)
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

    let ws = NETWORK_CLIENT_IMPL.createClientWebSocket(`ws://${peerHost}:${peerPort}/events`)

    this.addPeerBySocket(ws, `direct peer ${peerHost}:${peerPort}`)
  }

  private async addPeerBySocket(ws, description: string) {
    let peerInfo: Blockchain.PeerInfo = null
    let connector = null

    ws.on('open', () => {
      console.log(`web socket connected`)

      connector = new Blockchain.WebSocketConnector(this.fullNode.node, ws)

      peerInfo = this.fullNode.addPeer(connector, description)
    })

    ws.on('error', (err) => {
      console.log(`error on ws : ${err}`)
      ws.close()
    })

    ws.on('close', () => {
      connector && connector.terminate()
      connector = null
      this.fullNode.removePeer(peerInfo.id)

      console.log('closed peer connection')
    })
  }
}

function guid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}