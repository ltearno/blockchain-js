import { Component } from '@angular/core'
import * as Blockchain from 'blockchain-js-core'
/*import * as Block from 'blockchain-js-core/target/block'
import * as FullNode from 'blockchain-js-core/target/full-node'
import * as NetworkClientBrowserImpl from 'blockchain-js-core/target/network-client-browser-impl'*/

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

  constructor() {
    let networkClientBrowserImpl = new Blockchain.NetworkClientBrowserImpl()
    this.fullNode = new Blockchain.FullNode(networkClientBrowserImpl)
    console.log(`full node created : ${this.fullNode.node.name}`)

    this.fullNode.node.addEventListener('head', async () => {
      this.headHistory.unshift(await this.fullNode.node.blockChainHead(Blockchain.MASTER_BRANCH))

      let state = []

      for (let branch of await this.fullNode.node.branches()) {
        console.log(`branch ${branch}`)

        let toFetch = await this.fullNode.node.blockChainHead(Blockchain.MASTER_BRANCH)

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

  async mine() {
    try {
      this.fullNode.miner.addData(Blockchain.MASTER_BRANCH, "Hello my friend !")
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

    this.fullNode.addPeer({
      address: peerHost,
      port: peerPort
    })
  }
}
