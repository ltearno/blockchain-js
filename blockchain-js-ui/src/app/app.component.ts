import { Component } from '@angular/core'
import * as Blockchain from 'blockchain-js-core'
/*import * as Block from 'blockchain-js-core/target/block'
import * as FullNode from 'blockchain-js-core/target/full-node'
import * as NetworkClientBrowserImpl from 'blockchain-js-core/target/network-client-browser-impl'*/

const NETWORK_CLIENT_IMPL = new Blockchain.NetworkClientBrowserImpl()

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  title = 'app'
  fullNode: Blockchain.FullNode = null
  headHistory: string[] = []
  logs: string[] = []
  state = []
  peers: {
    host: string,
    port: number,
    connected: boolean
  }[] = []

  constructor() {
    this.fullNode = new Blockchain.FullNode(NETWORK_CLIENT_IMPL)
    console.log(`full node created : ${this.fullNode.node.name}`)

    this.fullNode.node.addEventListener('head', async branch => {
      this.headHistory.unshift(`new head on branch ${branch} : ${await this.fullNode.node.blockChainHead(branch)}`)

      let state = []

      for (let branch of await this.fullNode.node.branches()) {
        console.log(`branch ${branch}`)

        let toFetch = await this.fullNode.node.blockChainHead(branch)

        console.log(` head ${toFetch}`)

        let branchState = {
          branch: branch,
          head: toFetch,
          blocks: []
        }

        while (toFetch) {
          console.log(`fetching block ${toFetch}`)
          let blockMetadatas = await this.fullNode.node.blockChainBlockMetadata(toFetch, 1)
          let blockMetadata = blockMetadatas && blockMetadatas[0]
          let blockDatas = await this.fullNode.node.blockChainBlockData(toFetch, 1)
          let blockData = blockDatas && blockDatas[0]

          console.log(`block metadata : ${JSON.stringify(blockMetadata)}`)
          console.log(`block data : ${JSON.stringify(blockData)}`)

          branchState.blocks.push({ blockMetadata, blockData })

          toFetch = blockData && blockData.previousBlockId
        }

        state.push(branchState)
      }

      this.state = state
    })
  }

  async mine(minedData) {
    try {
      this.fullNode.miner.addData(Blockchain.MASTER_BRANCH, minedData)
      let mineResult = await this.fullNode.miner.mineData()
      this.logs.push(`mine result: ${JSON.stringify(mineResult)}`)
    }
    catch (error) {
      this.logs.push(`error mining: ${JSON.stringify(error)}`)
      throw error
    }
  }

  async addPeer(peerHost, peerPort) {
    console.log(`add peer ${peerHost}:${peerPort}`)

    let existingPeer = this.peers.find(p => p.host == peerHost && p.port == peerPort)
    if (existingPeer && existingPeer.connected) {
      console.log(`already connected`)
      return
    }

    if (!existingPeer) {
      existingPeer = {
        host: peerHost,
        port: peerPort,
        connected: true
      }

      this.peers.push(existingPeer)
    }

    let ws = NETWORK_CLIENT_IMPL.createClientWebSocket(`ws://${peerHost}:${peerPort}/events`)

    let peerInfo = null

    let connector = null
    ws.on('open', () => {
      console.log(`web socket connected ${peerHost} ${peerPort}`)

      connector = new Blockchain.WebSocketConnector(this.fullNode.node, ws)

      peerInfo = this.fullNode.addPeer(connector)

      existingPeer.connected = true
    })

    ws.on('error', (err) => {
      console.log(`error on ws : ${err}`)
      ws.close()

      existingPeer.connected = false
    })

    ws.on('close', () => {
      connector && connector.terminate()
      connector = null
      this.fullNode.removePeer(peerInfo.id)

      console.log('closed')

      existingPeer.connected = false
    })
  }
}
