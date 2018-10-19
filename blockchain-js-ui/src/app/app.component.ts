import { Component, OnInit } from '@angular/core'
import {
  Block,
  FullNode,
  ListOnChain,
  HashTools,
  KeyValueStorage,
  SequenceStorage,
  SmartContract,
  NodeBrowser,
  NetworkApi,
  NetworkClientBrowserImpl,
  NodeApi,
  NodeImpl,
  NodeTransfer,
  NodeNetworkClient,
  WebsocketConnector
} from 'blockchain-js-core'
import * as PeerToPeer from 'rencontres'
import * as CryptoJS from 'crypto-js'
import { WebSocketConnector } from 'blockchain-js-core/dist/websocket-connector';

const NETWORK_CLIENT_IMPL = new NetworkClientBrowserImpl.NetworkClientBrowserImpl()
const STORAGE_BLOCKS = 'blocks'
const STORAGE_SETTINGS = 'settings'

const IDENTITY_REGISTRY_CONTRACT_ID = "identity-registry-1"
const SUPPLY_CHAIN_CONTRACT_ID = "supply-chain-v1"
const RANDOM_GENERATOR_CONTRACT_ID = "random-generator-v1"

function sleep(time: number) {
  return new Promise((resolve, reject) => setTimeout(resolve, time))
}

declare function require(v: any): any;

// TODO affichger la profondeur des données (pour savoir si elles sont fiables)
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
  userComment: string = null
  keys: {
    privateKey: string;
    publicKey: string;
  } = null
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

  selectedTab = 5
  _selectedBranch = Block.MASTER_BRANCH

  private messageSequence: SequenceStorage.SequenceStorage

  get selectedBranch() {
    return this._selectedBranch
  }

  set selectedBranch(branch: string) {
    this.selectedBranch = branch
    this.messageSequence.setBranch(branch)
  }

  fullNode: FullNode.FullNode = null
  smartContract: SmartContract.SmartContract = null
  logs: string[] = []
  state: {
    [key: string]: {
      branch: string
      head: string
      blocks: any[]
    }
  } = { "master": { branch: Block.MASTER_BRANCH, head: null, blocks: [] } }

  p2pBroker: PeerToPeer.PeerToPeerBrokering

  isMining = false
  autoMining = false
  autoMiningIteration = 1

  accepting = new Map<string, { offerId: string; offerMessage: string }>()
  knownAcceptedMessages = new Set<string>()

  private peersSockets = new Map<FullNode.PeerInfo, { ws: NetworkApi.WebSocket, isSelfInitiated: boolean, counterpartyId: string }>()

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

    setTimeout(() => {
      this.registerIdentity(this.userComment || 'no comment')
    }, 5000)

    this.p2pBroker = new PeerToPeer.PeerToPeerBrokering(`${location.protocol == 'https' ? 'wss' : 'ws'}://${window.location.hostname}:8999/signal`,
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

  private messages = []
  private lastMessagesBlockId = ''

  private updateStatusFromSequence(sequenceItemsByBlock: { blockId: string; items: SequenceStorage.SequenceItem[] }[]) {
    let startIdx
    for (startIdx = sequenceItemsByBlock.length - 1; startIdx >= 0; startIdx--) {
      if (sequenceItemsByBlock[startIdx].blockId == this.lastMessagesBlockId) {
        startIdx++ // because we start AFTER the last cached block
        break
      }
    }
    if (startIdx < 0)
      startIdx = 0

    for (let idx = startIdx; idx < sequenceItemsByBlock.length; idx++) {
      let { blockId, items } = sequenceItemsByBlock[idx]
      this.messages = this.messages.concat(items)
    }

    this.lastMessagesBlockId = sequenceItemsByBlock[sequenceItemsByBlock.length - 1].blockId
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

  private callContract: (contractUuid: any, iterationId: any, method: any, account: any, data: any) => Promise<any> = null
  private supplyChainCall = async (method, account, data) => this.callContract(SUPPLY_CHAIN_CONTRACT_ID, 0, method, account, data)

  private initFullNode() {
    this.fullNode = new FullNode.FullNode(NETWORK_CLIENT_IMPL)

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

    this.messageSequence = new SequenceStorage.SequenceStorage(
      this.fullNode.node,
      this.selectedBranch,
      `demo-chat-v1`,
      this.fullNode.miner)
    this.messageSequence.initialise()

    this.messageSequence.addEventListener('change', (sequenceItemsByBlock) => this.updateStatusFromSequence(sequenceItemsByBlock))

    this.smartContract = new SmartContract.SmartContract(this.fullNode.node, Block.MASTER_BRANCH, 'people', this.fullNode.miner)
    this.smartContract.initialise()

    this.callContract = async (contractUuid, iterationId, method, account, data) => {
      data.email = account.email
      if (this.smartContract.hasContract(contractUuid)) {
        let callId = await this.smartContract.callContract(contractUuid, iterationId, method, account ? HashTools.signAndPackData(data, account.keys.privateKey) : data)
        return await waitReturn(this.smartContract, callId)
      }

      return false
    }
  }

  async setPseudo(pseudo: string, comment: string, enablePeerToPeer: boolean) {
    if (pseudo == '')
      return

    this.userStarted = true

    this.pseudo = pseudo.indexOf('@') >= 0 ? pseudo : `${pseudo}@blockchain-js.com`
    this.userComment = comment
    this.autoP2P = enablePeerToPeer

    this.savePreferencesToLocalStorage()

    this.maybeOfferP2PChannel()
  }

  // TODO : first time pseudo is validate AND smart contracts are available
  async registerIdentity(comment: string) {
    let result = await this.registerIdentityImpl(comment)
    if (!result)
      setTimeout(() => this.registerIdentity(comment), 5000)
  }

  async registerIdentityImpl(comment: string): Promise<boolean> {
    console.log(`try registering identity`)

    // TODO store that in sth
    if (!this.keys) {
      this.keys = await HashTools.generateRsaKeyPair()
      this.savePreferencesToLocalStorage()
    }

    if (!this.smartContract.hasContract(IDENTITY_REGISTRY_CONTRACT_ID)) {
      return false
    }

    let identityContractState = this.smartContract.getContractState(IDENTITY_REGISTRY_CONTRACT_ID)
    if (!identityContractState) {
      console.log(`no identity contract state`)
      return false
    }
    if (identityContractState.identities[this.pseudo]) {
      console.log(`already registered identity ${this.pseudo}`)
      return true
    }

    // TODO use smart contract to register an identity and a profile
    let account = {
      keys: this.keys,
      email: this.pseudo
    }
    if (! await this.callContract(IDENTITY_REGISTRY_CONTRACT_ID, 0, 'registerIdentity', account, {
      comment: comment || ''
    })) {
      console.error(`failed to register identity`)
      return false
    }

    console.log(`identity registered with email ${account.email}`)

    let identity = await this.supplyChainCall('createAccount', account, {})
    if (!identity) {
      console.log(`account cannot be created`)
      return false
    }

    console.log(`created account : ${account.email}`)

    return true
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

  toList(obj) {
    return Object.getOwnPropertyNames(obj).map(p => obj[p])
  }

  keysOf(obj) {
    return Object.keys(obj)
  }

  supplyChainReport = {}
  supplyChainState = null

  async refreshSupplyChainSummary() {
    this.supplyChainState = await this.smartContract.simulateCallContract(SUPPLY_CHAIN_CONTRACT_ID, 0, 'getState')

    let nbClosedAsks = 0
    let nbOpenAsks = 0

    for (let askId in this.supplyChainState.asks) {
      let ask = this.supplyChainState.asks[askId]
      if (ask.asks.every(askItem => askItem.bidId != null))
        nbClosedAsks++
      else
        nbOpenAsks++
    }

    let nbSelectedBids = 0
    let nbUnselectedBids = 0

    for (let bidId in this.supplyChainState.bids) {
      let bid = this.supplyChainState.bids[bidId]
      if (bid.selected)
        nbSelectedBids++
      else
        nbUnselectedBids++
    }

    this.supplyChainReport = JSON.stringify({
      users: this.supplyChainState.users,
      asks: {
        nb: Object.getOwnPropertyNames(this.supplyChainState.asks).length,
        nbOpenAsks,
        nbClosedAsks
      },
      bids: {
        nb: Object.getOwnPropertyNames(this.supplyChainState.bids).length,
        nbUnselectedBids,
        nbSelectedBids
      }
    }, null, 4)
  }

  async supplyChainAsk() {
    let account = {
      keys: this.keys,
      email: this.pseudo
    }

    await this.supplyChainCall('publishAsk', account, {
      id: await HashTools.hashString(Math.random() + ''),
      title: `Something`,
      description: `Something`,
      asks: [
        {
          description: `first`
        },
        {
          description: `second`
        }
      ]
    })
  }

  async publishBid(askId, askIndex) {
    let account = {
      keys: this.keys,
      email: this.pseudo
    }

    if (! await this.supplyChainCall('publishBid', account, {
      id: await HashTools.hashString(Math.random() + ''),
      askId,
      askIndex,
      itemId: 'pneu',
      title: `...`,
      price: 1,
      description: `...`,
      specification: ``
    })) {
      console.error(`cannot publish bid!`)
    }
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

      this.messageSequence.addItems([dataItem])

      /** TODO : refactor this : mining difficulty adjustment and selecte dbranch
      this.fullNode.miner.addData(this.selectedBranch, dataItem)
      let mineResult = await this.fullNode.miner.mineData(this.miningDifficulty, 30)
      this.log(`finished mining: ${JSON.stringify(mineResult)}`)*/
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

    let ws = NETWORK_CLIENT_IMPL.createClientWebSocket(`${location.protocol == 'https' ? 'wss' : 'ws'}://${peerHost}:${peerPort}/events`)

    this.addPeerBySocket(ws, `${peerHost}:${peerPort}`, true, `direct peer ${peerHost}:${peerPort}`)
  }

  private addPeerBySocket(ws: NetworkApi.WebSocket, counterpartyId: string, isSelfInitiated: boolean, description: string) {
    let peerInfo: FullNode.PeerInfo = null
    let connector = null

    ws.on('open', () => {
      console.log(`peer connected`)

      connector = new WebSocketConnector(this.fullNode.node, ws)

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

  disconnectPeer(peerInfo: FullNode.PeerInfo) {
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
      userComment: this.userComment,
      keys: this.keys,
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

      if (settings.userComment)
        this.userComment = settings.userComment

      if (settings.keys)
        this.keys = settings.keys

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
    let blocks: Map<string, Block.Block> = this.fullNode.node.blocks()
    blocks.forEach((block, blockId) => toSave.push({ blockId, block }))
    localStorage.setItem(STORAGE_BLOCKS, JSON.stringify(toSave))
    this.log(`blocks saved`)
  }
}

async function waitReturn(smartContract, callId) {
  await waitUntil(() => smartContract.hasReturnValue(callId))
  return smartContract.getReturnValue(callId)
}

async function waitUntil(condition: () => Promise<boolean>) {
  while (!await condition())
    await wait(50)
}

function wait(duration: number) {
  return new Promise((resolve, reject) => {
    setTimeout(() => resolve(), duration)
  })
}