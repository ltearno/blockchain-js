import { Component, ViewChild, AfterViewInit } from '@angular/core'
import {
  Block,
  FullNode,
  NetworkApi,
  NetworkClientBrowserImpl
} from 'blockchain-js-core'
import * as CryptoJS from 'crypto-js'
import { WebSocketConnector } from 'blockchain-js-core/dist/websocket-connector'
import { State } from './supply-chain/state'
import * as Paint from './supply-chain/paint'
import * as Blockchain from 'blockchain-js-core'

const NETWORK_CLIENT_IMPL = new NetworkClientBrowserImpl.NetworkClientBrowserImpl()

const STORAGE_BLOCKS = 'blocks'
const STORAGE_SETTINGS = 'settings'

function sleep(time: number) {
  return new Promise((resolve, reject) => setTimeout(resolve, time))
}

@Component({
  selector: 'body',
  templateUrl: './app.component.html',
  providers: [State]
})
export class AppComponent {
  @ViewChild("mainElement")
  mainElement

  // To save
  encryptMessages = false
  encryptionKey = this.guid()
  otherEncryptionKeys: string[] = []
  desiredNbIncomingPeers = 3
  desiredNbOutgoingPeers = 3
  autoSave = true
  autoConnectNaturalPeer = true
  miningDifficulty = 100

  expandedUi = false
  selectedTab = 5

  isMining = false
  autoMining = false
  autoMiningIteration = 1

  accepting = new Map<string, { offerId: string; offerMessage: string }>()
  knownAcceptedMessages = new Set<string>()

  _selectedBranch = Blockchain.Block.MASTER_BRANCH

  get selectedBranch() {
    return this._selectedBranch
  }

  set selectedBranch(branch: string) {
    this._selectedBranch = branch
  }

  _supplyChainBranch = null

  get supplyChainBranch() {
    return this._supplyChainBranch
  }

  set supplyChainBranch(value) {
    if (this._supplyChainBranch == value)
      return

    this._supplyChainBranch = value
    this.state.smartContract.setBranch(value)
  }

  private peersSockets = new Map<FullNode.PeerInfo, { ws: NetworkApi.WebSocket, isSelfInitiated: boolean, counterpartyId: string }>()

  private decypherCache = new Map<string, string>()

  toggleFullScreen() {
    if (this.mainElement.nativeElement.requestFullscreen)
      this.mainElement.nativeElement.requestFullscreen()
    else if (this.mainElement.nativeElement.webkitRequestFullScreen)
      this.mainElement.nativeElement.webkitRequestFullScreen()
  }

  toggleExpandedUi() {
    this.expandedUi = !this.expandedUi
  }

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
    window.addEventListener('beforeunload', _ => {
      if (this.autoSave) {
        this.savePreferencesToLocalStorage()
      }
    })

    this.state.init()
    Paint.setSmartProgram(this.state.smartContract)

    this.loadPreferencesFromLocalStorage()
    //this.tryLoadBlocksFromLocalStorage()

    this.ensureUser()

    if (this.autoConnectNaturalPeer) {
      this.connectToNaturalRemoteNode()
      this.connectToRemoteMiner()
    }
    setInterval(() => {
      if (this.autoConnectNaturalPeer) {
        this.connectToNaturalRemoteNode()
        this.connectToRemoteMiner()
      }
    }, 5000)
  }

  setPseudo(pseudo: string) {
    this.state.callContract(this.state.IDENTITY_REGISTRY_CONTRACT_ID, 0, 'setPseudo', this.state.user, { pseudo })
  }

  setSummplyChainBranch(branch: string) {
    this.supplyChainBranch = branch
  }

  private async ensureUser() {
    if (this.state.user)
      return

    const id = this.guid()
    const keys = await Blockchain.HashTools.generateRsaKeyPair()
    this.state.setUserInformations(id, keys)
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
        author: this.state.user.id,
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

  private remoteMinerWebSocket: NetworkApi.WebSocket

  private connectToRemoteMiner() {
    if (this.remoteMinerWebSocket)
      return

    return
    /*
        let protocol = location.protocol.startsWith('https') ? 'wss' : 'ws'
        let host = location.hostname
        let port = protocol == 'wss' ? 443 : 9091
    
        this.remoteMinerWebSocket = NETWORK_CLIENT_IMPL.createClientWebSocket(`${protocol}://${host}:${port}/mining`)
    
        let addData = async (branch: string, data: any): Promise<boolean> => {
          if (!this.remoteMinerWebSocket)
            return false
    
          try {
            this.remoteMinerWebSocket.send(JSON.stringify({ branch, data }))
            return true
          }
          catch (error) {
            return false
          }
        }
    
        this.remoteMinerWebSocket.on('open', () => {
          console.log(`remote miner connected`)
          this.state.remoteMining = addData
        })
    
        this.remoteMinerWebSocket.on('error', (err) => {
          console.log(`error with remote miner : ${err}`)
          this.state.remoteMining = null
          this.remoteMinerWebSocket.close()
        })
    
        this.remoteMinerWebSocket.on('close', () => {
          console.log('remote miner disconnected')
          this.state.remoteMining = null
          this.remoteMinerWebSocket = null
        })
        */
  }

  private naturalRemoteWebSocket: NetworkApi.WebSocket

  private connectToNaturalRemoteNode() {
    if (this.naturalRemoteWebSocket)
      return

    let protocol = location.protocol.startsWith('https') ? 'wss' : 'ws'
    let host = location.hostname
    let basePath = ''
    console.log(location.pathname)
    console.log(location.pathname.lastIndexOf('/'))
    if (location.pathname.lastIndexOf('/') > 0) {
      basePath = location.pathname.substring(0, location.pathname.lastIndexOf('/'))
    }
    let port = protocol == 'wss' ? 443 : 9091

    this.naturalRemoteWebSocket = NETWORK_CLIENT_IMPL.createClientWebSocket(`${protocol}://${host}:${port}${basePath}/events`)

    this.naturalRemoteWebSocket.on('error', (err) => {
      console.error(`error with natural peer : ${err}`)
      this.naturalRemoteWebSocket.close()
    })

    this.naturalRemoteWebSocket.on('close', () => {
      console.error('natural peer disconnected')
      this.naturalRemoteWebSocket = null
    })

    this.addPeerBySocket(this.naturalRemoteWebSocket, `natural-remote`, true, `natural direct peer ${host}:${port}`)
  }

  addPeer(peerHost, peerPort, peerSecure) {
    console.log(`add peer ${peerHost}:${peerPort}`)

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
      if (peerInfo) {
        this.state.fullNode.removePeer(peerInfo.id)
        this.peersSockets.delete(peerInfo)
      }

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

  clearStorageAndReload() {
    this.autoSave = false
    this.autoConnectNaturalPeer = false
    localStorage.clear()
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
      id: this.state.user && this.state.user.id,
      keys: this.state.user && this.state.user.keys,
      encryptMessages: this.encryptMessages,
      encryptionKey: this.encryptionKey,
      otherEncryptionKeys: this.otherEncryptionKeys,
      desiredNbIncomingPeers: this.desiredNbIncomingPeers,
      desiredNbOutgoingPeers: this.desiredNbOutgoingPeers,
      miningDifficulty: this.miningDifficulty,
      autoSave: this.autoSave,
      autoConnectNaturalPeer: this.autoConnectNaturalPeer
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

      if (settings.keys && settings.id) {
        this.state.setUserInformations(settings.id, settings.keys)
      }

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

      if (settings.autoConnectNaturalPeer !== undefined)
        this.autoConnectNaturalPeer = settings.autoConnectNaturalPeer

      this.autoSave = !!settings.autoSave

      this.log(`preferences loaded`)
    }
    catch (e) {
      this.log(`error loading preferences ${e}`)
    }
  }
}