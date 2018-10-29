import { Component } from '@angular/core'
import {
  Block,
  FullNode,
  NetworkApi,
  NetworkClientBrowserImpl
} from 'blockchain-js-core'
import * as CryptoJS from 'crypto-js'
import { WebSocketConnector } from 'blockchain-js-core/dist/websocket-connector';
import { State } from './supply-chain/state';

const NETWORK_CLIENT_IMPL = new NetworkClientBrowserImpl.NetworkClientBrowserImpl()

const STORAGE_BLOCKS = 'blocks'
const STORAGE_SETTINGS = 'settings'

function sleep(time: number) {
  return new Promise((resolve, reject) => setTimeout(resolve, time))
}

@Component({
  selector: 'body',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  providers: [State]
})
export class AppComponent {
  proposedPseudo = this.guid()

  // To save
  encryptMessages = false
  encryptionKey = this.guid()
  otherEncryptionKeys: string[] = []
  desiredNbIncomingPeers = 3
  desiredNbOutgoingPeers = 3
  autoSave = true
  autoStart = true
  miningDifficulty = 100
  maxNumberDisplayedMessages = 100

  selectedTab = 5

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

  get incomingPeersCount() {
    let count = 0
    this.state.fullNode.peerInfos.forEach(peer => {
      if (this.peersSockets.has(peer) && !this.peersSockets.get(peer).isSelfInitiated)
        count++
    })
    return count
  }

  get outgoingPeersCount() {
    let count = 0
    this.state.fullNode.peerInfos.forEach(peer => {
      if (this.peersSockets.has(peer) && this.peersSockets.get(peer).isSelfInitiated)
        count++
    })
    return count
  }

  constructor(public state: State) {
    this.onUnloadListener = _ => {
      if (this.autoSave) {
        this.saveBlocks()

        this.savePreferencesToLocalStorage()
      }
      else {
        this.resetStorage()
      }
    }

    window.addEventListener('beforeunload', this.onUnloadListener)

    this.state.init(() => this.savePreferencesToLocalStorage())
    this.loadPreferencesFromLocalStorage()
    this.tryLoadBlocksFromLocalStorage()
  }

  async setPseudo(pseudo: string, comment: string) {
    if (pseudo == '')
      return

    this.state.setPseudo(pseudo, comment)

    this.savePreferencesToLocalStorage()
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
        author: this.state.user.pseudo,
        message,
        encrypted: false
      }

      if (this.encryptMessages && this.encryptionKey) {
        dataItem.message = dataItem.message.padStart(3, '=')

        this.addEncryptionKey(this.encryptionKey)
        dataItem.message = CryptoJS.AES.encrypt(dataItem.message + dataItem.message.substr(-3), this.encryptionKey).toString()
        dataItem.encrypted = true
      }

      this.state.messageSequence.addItems([dataItem])
    }
    catch (error) {
      this.log(`error mining: ${JSON.stringify(error)}`)
    }
    finally {
      this.isMining = false
    }
  }

  log(message) {
    this.state.log(message)
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

  async addPeer(peerHost, peerPort, peerSecure) {
    console.log(`add peer ${peerHost}:${peerPort}`)

    //let ws = NETWORK_CLIENT_IMPL.createClientWebSocket(`${window.location.protocol.startsWith('https') ? 'wss' : 'ws'}://${peerHost}:${peerPort}/events`)
    let ws = NETWORK_CLIENT_IMPL.createClientWebSocket(`${peerSecure ? 'wss' : 'ws'}://${peerHost}:${peerPort}/events`)

    this.addPeerBySocket(ws, `${peerHost}:${peerPort}`, true, `direct peer ${peerHost}:${peerPort}`)
  }

  private addPeerBySocket(ws: NetworkApi.WebSocket, counterpartyId: string, isSelfInitiated: boolean, description: string) {
    let peerInfo: FullNode.PeerInfo = null
    let connector = null

    ws.on('open', () => {
      console.log(`peer connected`)

      connector = new WebSocketConnector(this.state.fullNode.node, ws)

      peerInfo = this.state.fullNode.addPeer(connector, description)
      this.peersSockets.set(peerInfo, { ws, counterpartyId, isSelfInitiated })
    })

    ws.on('error', (err) => {
      console.log(`error with peer : ${err}`)
      ws.close()
    })

    ws.on('close', () => {
      connector && connector.terminate()
      connector = null
      this.state.fullNode.removePeer(peerInfo.id)
      this.peersSockets.delete(peerInfo)

      console.log('peer disconnected')
    })
  }

  disconnectPeer(peerInfo: FullNode.PeerInfo) {
    this.state.fullNode.removePeer(peerInfo.id)
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
      pseudo: this.state.user && this.state.user.pseudo,
      userComment: this.state.user && this.state.user.comment,
      keys: this.state.user && this.state.user.keys,
      encryptMessages: this.encryptMessages,
      encryptionKey: this.encryptionKey,
      otherEncryptionKeys: this.otherEncryptionKeys,
      desiredNbIncomingPeers: this.desiredNbIncomingPeers,
      desiredNbOutgoingPeers: this.desiredNbOutgoingPeers,
      miningDifficulty: this.miningDifficulty,
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
        this.proposedPseudo = settings.pseudo || this.guid()

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

      this.autoSave = !!settings.autoSave
      this.autoStart = !!settings.autoStart

      this.log(`preferences loaded`)

      if (this.autoStart) {
        if (settings.pseudo)
          this.state.setPseudo(settings.pseudo, settings.userComment)
      }

      if (settings.keys && this.state.user)
        this.state.user.keys = settings.keys
    }
    catch (e) {
      this.log(`error loading preferences ${e}`)
    }
  }

  private async tryLoadBlocksFromLocalStorage() {
    let storageBlocksString = localStorage.getItem(STORAGE_BLOCKS)
    if (storageBlocksString) {
      try {
        let storageBlocks = Block.deserializeBlockData(storageBlocksString)
        if (Array.isArray(storageBlocks)) {
          this.log(`loading blocks from local storage`)
          let i = 0
          for (let { blockId, block } of storageBlocks) {
            this.state.fullNode.node.registerBlock(blockId, block)
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

  async saveBlocks() {
    // TODO only save blocks that are in branches...
    console.log(`saving blocks...`)
    let toSave = []
    let blocks: Map<string, Block.Block> = this.state.fullNode.node.blocks()
    let itr = blocks.entries()

    for (let it = itr.next(); !it.done; it = itr.next()) {
      let [blockId, block] = it.value
      toSave.push({ blockId, block })
    }

    localStorage.setItem(STORAGE_BLOCKS, Block.serializeBlockData(toSave))
  }
}