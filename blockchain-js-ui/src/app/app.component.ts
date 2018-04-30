import { Component, OnInit } from '@angular/core'
import * as Blockchain from 'blockchain-js-core'
import * as PeerToPeer from 'rencontres'
import sha256 from 'crypto-js/sha256'
import hmacSHA512 from 'crypto-js/hmac-sha512'
import Base64 from 'crypto-js/enc-base64'
import * as CryptoJS from 'crypto-js'

const NETWORK_CLIENT_IMPL = new Blockchain.NetworkClientBrowserImpl()
const STORAGE_BLOCKS = 'blocks'
const STORAGE_SETTINGS = 'settings'

function sleep(time: number) {
  return new Promise((resolve, reject) => setTimeout(resolve, time))
}

// TODO affichage tous messages
// TODO clean

@Component({
  selector: 'body',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  proposedPseudo = this.guid()

  userStarted = false

  // To save
  pseudo = null
  encryptMessages = false
  encryptionKey = this.guid()
  otherEncryptionKeys: string[] = []
  desiredNbIncomingPeers = 3
  desiredNbOutgoingPeers = 3
  autoP2P = false
  autoSave = true
  autoStart = true
  miningDifficulty = 100
  maxNumberDisplayedMessages = 100

  selectedTab = 1
  selectedBranch = Blockchain.MASTER_BRANCH

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
  autoMining = false
  autoMiningIteration = 1

  accepting = new Map<string, { offerId: string; offerMessage: string }>()
  knownAcceptedMessages = new Set<string>()

  private peersSockets = new Map<Blockchain.PeerInfo, { ws: Blockchain.WebSocket, isSelfInitiated: boolean, counterpartyId: string }>()

  private decypherCache = new Map<string, string>()

  private onUnloadListener

  selectTab(i) {
    this.selectedTab = i
  }

  get branches() {
    return Object.getOwnPropertyNames(this.state)
  }

  get incomingPeersCount() {
    let count = 0
    this.fullNode.peerInfos.forEach(peer => {
      if (this.peersSockets.has(peer) && !this.peersSockets.get(peer).isSelfInitiated)
        count++
    })
    return count
  }

  get outgoingPeersCount() {
    let count = 0
    this.fullNode.peerInfos.forEach(peer => {
      if (this.peersSockets.has(peer) && this.peersSockets.get(peer).isSelfInitiated)
        count++
    })
    return count
  }

  constructor() {
    this.onUnloadListener = event => {
      if (this.autoSave) {
        this.saveBlocks()

        this.savePreferencesToLocalStorage()
      }
      else {
        this.resetStorage()
      }
    }

    window.addEventListener('beforeunload', this.onUnloadListener)

    this.loadPreferencesFromLocalStorage()

    this.initFullNode()

    this.p2pBroker = new PeerToPeer.PeerToPeerBrokering(`wss://${window.location.hostname}:8999/signal`,
      () => {
        this.maybeOfferP2PChannel()
      },

      (offerId, offerMessage) => {
        if (!this.autoP2P) {
          return { accepted: false, message: `nope` }
        }

        if (this.incomingPeersCount >= this.desiredNbIncomingPeers) {
          return { accepted: false, message: `nope` }
        }

        if (this.knownAcceptedMessages.has(offerMessage) || this.accepting.has(offerMessage)) {
          return { accepted: false, message: `i know you` }
        }

        this.accepting.set(offerMessage, { offerId, offerMessage })
        setTimeout(() => this.accepting.delete(offerMessage), 5000)

        this.log(`accepted offer ${offerId.substr(0, 7)}:${offerMessage}`)

        return { accepted: true, message: this.pseudo }
      },

      (description, channel) => {
        let counterPartyMessage = description.counterPartyMessage

        this.knownAcceptedMessages.add(counterPartyMessage)

        channel.on('close', () => this.knownAcceptedMessages.delete(counterPartyMessage))

        this.addPeerBySocket(channel, counterPartyMessage, description.isSelfInitiated, `p2p with ${counterPartyMessage} on channel ${description.offerId.substr(0, 5)} ${description.isSelfInitiated ? '[OUT]' : '[IN]'} (as '${this.pseudo}')`)

        setTimeout(() => this.maybeOfferP2PChannel(), 500)
      }
    )

    this.p2pBroker.createSignalingSocket()

    setInterval(() => {
      if (this.autoP2P && this.p2pBroker.ready)
        this.maybeOfferP2PChannel()
    }, 10000)

    if (this.autoStart && this.pseudo) {
      this.userStarted = true
    }
  }

  private nextLoad: { branch, blockId } = { branch: null, blockId: null }
  private lastLoaded = { branch: null, blockId: null }

  private triggerLoad(branch: string, blockId: string) {
    this.nextLoad = { branch, blockId }
  }

  private async loadState(branch: string, blockId: string) {
    if (this.state && this.state[branch] && this.state[branch].head == blockId)
      return

    // only update current state
    // stop when we encounter the current branch head
    // if not found, replace the head

    let state = {}

    let toFetch = blockId

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
      if (count > this.maxNumberDisplayedMessages)
        break
    }

    state[branch] = branchState

    this.state = state
  }

  private initFullNode() {
    this.fullNode = new Blockchain.FullNode(NETWORK_CLIENT_IMPL)

    setInterval(() => {
      if (this.lastLoaded.blockId != this.nextLoad.blockId || this.lastLoaded.branch != this.nextLoad.branch) {
        this.lastLoaded = { branch: this.nextLoad.branch, blockId: this.nextLoad.blockId }
        this.loadState(this.lastLoaded.branch, this.lastLoaded.blockId)
      }
    }, 500)

    this.tryLoadBlocksFromLocalStorage()

    this.fullNode.node.addEventListener('head', async (event) => {
      this.log(`new head on branch '${event.branch}': ${event.headBlockId.substr(0, 7)}`)
      this.triggerLoad(event.branch, event.headBlockId)
    })
  }

  setPseudo(pseudo, peerToPeer) {
    this.userStarted = true

    this.pseudo = pseudo
    this.autoP2P = peerToPeer

    this.maybeOfferP2PChannel()
  }

  maybeOfferP2PChannel() {
    if (this.autoP2P && this.p2pBroker.ready && this.outgoingPeersCount < this.desiredNbOutgoingPeers) {
      this.offerP2PChannel()
    }

    // CHECK ONLY ONE PEER BY COUNTERPARTYID

    // todo remove when too much peers ?
    // todo remove unconnected peers ?
  }

  offerP2PChannel() {
    let offerId = this.p2pBroker.offerChannel(this.pseudo)
  }

  addEncryptionKey(newEncryptionKey: string) {
    if (!newEncryptionKey || !newEncryptionKey.length || this.otherEncryptionKeys.includes(newEncryptionKey))
      return

    this.decypherCache.clear()

    this.otherEncryptionKeys.push(newEncryptionKey)
  }

  removeEncryptionKey(key) {
    this.otherEncryptionKeys = this.otherEncryptionKeys.filter(k => k != key)
  }

  decypher(message: string) {
    if (!message || message.length < 5)
      return `(invalid) ${message}`

    if (this.decypherCache.has(message))
      return this.decypherCache.get(message)

    let decypheredMessage = `(crypted) ${message}`
    for (let key of this.otherEncryptionKeys) {
      let decyphered = CryptoJS.AES.decrypt(message, key).toString(CryptoJS.enc.Utf8)
      if (!decyphered || decyphered.length < 6)
        continue

      console.log(`decy ${decyphered}`)

      let check = decyphered.substr(-3)
      decyphered = decyphered.substr(0, decyphered.length - 3)
      if (check == decyphered.substr(-3)) {
        this.decypherCache.set(message, decyphered)
        decypheredMessage = decyphered
        break
      }
    }

    this.decypherCache.set(message, decypheredMessage)

    return decypheredMessage
  }

  async mine(message: string) {
    if (this.isMining || message == '' || this.miningDifficulty <= 0)
      return

    this.isMining = true

    try {
      let dataItem = {
        id: this.guid(),
        author: this.pseudo,
        message,
        encrypted: false
      }

      if (this.encryptMessages && this.encryptionKey) {
        dataItem.message = dataItem.message.padStart(3, '=')

        this.addEncryptionKey(this.encryptionKey)
        dataItem.message = CryptoJS.AES.encrypt(dataItem.message + dataItem.message.substr(-3), this.encryptionKey).toString()
        dataItem.encrypted = true
      }

      this.log(`start mining...`)

      this.fullNode.miner.addData(this.selectedBranch, dataItem)
      let mineResult = await this.fullNode.miner.mineData(this.miningDifficulty, 30)
      this.log(`finished mining: ${JSON.stringify(mineResult)}`)
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

  toggleAutomine(minedData, automineTimer) {
    if (this.autoMining) {
      this.autoMining = false
    }
    else {
      this.autoMining = true

      let action = async () => {
        this.autoMining && await this.mine(`${minedData} - ${this.autoMiningIteration++}`)
        if (this.autoMining)
          setTimeout(action, automineTimer)
      }
      action()
    }
  }

  async addPeer(peerHost, peerPort) {
    console.log(`add peer ${peerHost}:${peerPort}`)

    let ws = NETWORK_CLIENT_IMPL.createClientWebSocket(`wss://${peerHost}:${peerPort}/events`)

    this.addPeerBySocket(ws, `${peerHost}:${peerPort}`, true, `direct peer ${peerHost}:${peerPort}`)
  }

  private addPeerBySocket(ws: Blockchain.WebSocket, counterpartyId: string, isSelfInitiated: boolean, description: string) {
    let peerInfo: Blockchain.PeerInfo = null
    let connector = null

    ws.on('open', () => {
      console.log(`peer connected`)

      connector = new Blockchain.WebSocketConnector(this.fullNode.node, ws)

      peerInfo = this.fullNode.addPeer(connector, description)
      this.peersSockets.set(peerInfo, { ws, counterpartyId, isSelfInitiated })
    })

    ws.on('error', (err) => {
      console.log(`error with peer : ${err}`)
      ws.close()
    })

    ws.on('close', () => {
      connector && connector.terminate()
      connector = null
      this.fullNode.removePeer(peerInfo.id)
      this.peersSockets.delete(peerInfo)

      console.log('peer disconnected')
    })
  }

  disconnectPeer(peerInfo: Blockchain.PeerInfo) {
    this.fullNode.removePeer(peerInfo.id)
    let ws = this.peersSockets.get(peerInfo)
    ws && ws.ws.close()
    this.peersSockets.delete(peerInfo)
  }

  guid() {
    //'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'
    return 'xxxxxxxxxx'.replace(/[xy]/g, (c) => {
      let r = Math.random() * 16 | 0
      let v = c == 'x' ? r : (r & 0x3 | 0x8)

      return v.toString(16)
    })
  }

  clearStorage() {
    localStorage.clear()
    window.removeEventListener('beforeunload', this.onUnloadListener)
    window.location.reload(true)
  }

  resetStorage() {
    localStorage.setItem(STORAGE_BLOCKS, JSON.stringify([]))

    let settings = {
      autoSave: false
    }

    localStorage.setItem(STORAGE_SETTINGS, JSON.stringify(settings))
  }

  savePreferencesToLocalStorage() {
    let settings = {
      pseudo: this.pseudo,
      encryptMessages: this.encryptMessages,
      encryptionKey: this.encryptionKey,
      otherEncryptionKeys: this.otherEncryptionKeys,
      desiredNbIncomingPeers: this.desiredNbIncomingPeers,
      desiredNbOutgoingPeers: this.desiredNbOutgoingPeers,
      miningDifficulty: this.miningDifficulty,
      autoP2P: this.autoP2P,
      autoSave: this.autoSave,
      autoStart: this.autoStart
    }

    localStorage.setItem(STORAGE_SETTINGS, JSON.stringify(settings))
    this.log(`preferences saved`)
  }

  loadPreferencesFromLocalStorage() {
    try {
      let settingsString = localStorage.getItem(STORAGE_SETTINGS)
      if (!settingsString || settingsString == '')
        return

      let settings = JSON.parse(settingsString)
      if (!settings)
        return

      if (settings.pseudo)
        this.proposedPseudo = this.pseudo = settings.pseudo || this.guid()

      if (settings.encryptMessages)
        this.encryptMessages = settings.encryptMessages || false

      if (settings.encryptionKey)
        this.encryptionKey = settings.encryptionKey || this.guid()

      if (settings.otherEncryptionKeys && Array.isArray(this.otherEncryptionKeys))
        settings.otherEncryptionKeys.forEach(element => this.otherEncryptionKeys.push(element))

      if (settings.desiredNbIncomingPeers)
        this.desiredNbIncomingPeers = settings.desiredNbIncomingPeers || 3

      if (settings.desiredNbOutgoingPeers)
        this.desiredNbOutgoingPeers = settings.desiredNbOutgoingPeers || 3

      if (settings.miningDifficulty)
        this.miningDifficulty = settings.miningDifficulty

      this.autoP2P = !!settings.autoP2P
      this.autoSave = !!settings.autoSave
      this.autoStart = !!settings.autoStart

      this.log(`preferences loaded`)
    }
    catch (e) {
      this.log(`error loading preferences`)
    }
  }

  private async tryLoadBlocksFromLocalStorage() {
    let storageBlocksString = localStorage.getItem(STORAGE_BLOCKS)
    if (storageBlocksString) {
      try {
        let storageBlocks = JSON.parse(storageBlocksString)
        if (Array.isArray(storageBlocks)) {
          this.log(`loading blocks from local storage`)
          let i = 0
          for (let { blockId, block } of storageBlocks) {
            this.fullNode.node.registerBlock(blockId, block)
            i++
            if (i % 2 == 0)
              await sleep(20)
          }
          this.log(`blocks restored from local storage`)
        }
      }
      catch (e) {
        this.log(`error loading from local storage : ${e}`)
      }
    }
  }

  saveBlocks() {
    // TODO only save blocks that are in branches...
    let toSave = []
    let blocks: Map<string, Blockchain.Block> = this.fullNode.node.blocks()
    blocks.forEach((block, blockId) => toSave.push({ blockId, block }))
    localStorage.setItem(STORAGE_BLOCKS, JSON.stringify(toSave))
    this.log(`blocks saved`)
  }
}