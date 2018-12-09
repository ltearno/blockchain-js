import { ProgramState } from './model'
import { Injectable } from '@angular/core'
import * as SupplyChainAdapter from '../supply-chain-adapter'
import * as Blockchain from 'blockchain-js-core'

export type RsaKeyPair = {
    privateKey: string;
    publicKey: string;
}

/**
 * Application state
 */
@Injectable()
export class State {
    IDENTITY_REGISTRY_CONTRACT_ID = "identity-registry-1"
    SUPPLY_CHAIN_CONTRACT_ID = "supply-chain-v1"
    //const RANDOM_GENERATOR_CONTRACT_ID = "random-generator-v1"

    logs: string[] = []

    log(message) {
        this.logs.unshift(message)
        if (this.logs.length > 20)
            this.logs.pop()
    }

    user: {
        id: string
        keys: RsaKeyPair
    } = null

    get registeredPseudo() {
        return this.user && this.identities && this.identities[this.user.id] && this.identities[this.user.id].pseudo
    }

    currentHead = ''

    hasSupplyChainAccount = false

    setUserInformations(userId: string, keys: RsaKeyPair) {
        if (!userId || !keys) // TODO better check
            return

        if (this.user)
            throw `error user already set`

        this.user = {
            id: userId,
            keys
        }
    }

    fullNode: Blockchain.FullNode.FullNode = null

    _selectedBranch = Blockchain.Block.MASTER_BRANCH

    get selectedBranch() {
        return this._selectedBranch
    }

    set selectedBranch(branch: string) {
        this._selectedBranch = branch
        this.messageSequence.setBranch(branch)
    }

    state: {
        [key: string]: {
            branch: string
            head: string
            headBlock: any[]
        }
    } = { "master": { branch: Blockchain.Block.MASTER_BRANCH, head: null, headBlock: [] } }

    messageSequence: Blockchain.SequenceStorage.SequenceStorage
    supplyChainBranchSequence: Blockchain.SequenceStorage.SequenceStorage
    supplyChainBranches: string[] = []
    smartContract: Blockchain.SmartContract.SmartContract = null
    suppyChain: SupplyChainAdapter.SupplyChainAdapter = new SupplyChainAdapter.SupplyChainAdapter()

    // a counter to know which components are loading something
    loaders = 0

    isLoading() {
        return this.loaders > 0 || this.fullNode.transfer.isLoading() || this.smartContract.processing
    }

    init() {
        this.initFullNode()

        setTimeout(() => {
            this.registerIdentity()
        }, 1000)
    }

    get branches() {
        return Object.keys(this.state)
    }

    programState: ProgramState = null

    identities: { [id: string]: { pseudo: string; publicKey: string } } = {}

    private nextLoad: { branch, blockId } = { branch: null, blockId: null }
    private lastLoaded = { branch: null, blockId: null }

    private messages = []

    hasIdentityContract = false
    registeredOnIdentityContract = false

    callContract = async (contractUuid, iterationId, method, account, data) => {
        if (this.smartContract.hasContract(contractUuid)) {
            data.id = account.id
            let callId = await this.smartContract.callContract(contractUuid, iterationId, method, account ? Blockchain.HashTools.signAndPackData(data, account.keys.privateKey) : data)
            return await waitReturn(this.smartContract, callId)
        }

        return false
    }

    supplyChainCall = async (method, account, data) => this.callContract(this.SUPPLY_CHAIN_CONTRACT_ID, 0, method, account, data)

    remoteMining: (branch: string, data: any) => Promise<boolean> = null

    miningRouter: Blockchain.MinerApi.MinerApi = {
        addData: async (branch: string, data: any) => {
            if (this.remoteMining) {
                try {
                    let ok = await this.remoteMining(branch, data)
                    if (ok)
                        return
                }
                catch (error) {
                    console.warn(`exception while remotely mining`, error)
                }
            }

            this.localMiner.addData(branch, data)
        }
    }

    private localMiner: Blockchain.MinerImpl.MinerImpl

    private initFullNode() {
        this.fullNode = new Blockchain.FullNode.FullNode(this.miningRouter)
        this.localMiner = new Blockchain.MinerImpl.MinerImpl(this.fullNode.node)

        setInterval(() => {
            if (this.lastLoaded.blockId != this.nextLoad.blockId || this.lastLoaded.branch != this.nextLoad.branch) {
                this.lastLoaded = { branch: this.nextLoad.branch, blockId: this.nextLoad.blockId }
                this.loadState(this.lastLoaded.branch, this.lastLoaded.blockId)
            }
        }, 500)

        this.fullNode.node.addEventListener('head', (event) => {
            //this.log(`new head on branch '${event.branch}': ${event.headBlockId.substr(0, 7)}`)
            if (event.branch != Blockchain.Block.MASTER_BRANCH)
                return

            this.triggerLoad(event.branch, event.headBlockId)
            this.currentHead = event.headBlockId.substr(0, 7)
        })

        this.supplyChainBranchSequence = new Blockchain.SequenceStorage.SequenceStorage(
            this.fullNode.node,
            Blockchain.Block.MASTER_BRANCH,
            `supply-chain-branch-sequence`,
            this.fullNode.miner)
        this.supplyChainBranchSequence.initialise()
        this.supplyChainBranchSequence.addEventListener('change', (sequenceItemsByBlock) => {
            console.log(`JKJKAHGKJHAGKJAHGKAJHGK`, sequenceItemsByBlock);

            this.supplyChainBranches = []
            for (let { blockId, items } of sequenceItemsByBlock) {
                items.forEach(item => {
                    if (typeof item === 'string')
                        this.supplyChainBranches.push(item)
                })
            }
        })

        this.messageSequence = new Blockchain.SequenceStorage.SequenceStorage(
            this.fullNode.node,
            this.selectedBranch,
            `demo-chat-v1`,
            this.fullNode.miner)
        this.messageSequence.initialise()

        this.messageSequence.addEventListener('change', (sequenceItemsByBlock) => this.updateStatusFromSequence(sequenceItemsByBlock))

        this.smartContract = new Blockchain.SmartContract.SmartContract(this.fullNode.node, Blockchain.Block.MASTER_BRANCH, 'people', this.fullNode.miner)
        this.smartContract.addChangeListener(() => {
            this.programState = JSON.parse(JSON.stringify(this.suppyChain.getSuppyChainState()))

            if (this.smartContract.hasContract(this.IDENTITY_REGISTRY_CONTRACT_ID)) {
                let identityContractState = this.smartContract.getContractState(this.IDENTITY_REGISTRY_CONTRACT_ID)
                if (identityContractState && identityContractState.identities) {
                    this.identities = identityContractState.identities
                }
            }
        })
        this.smartContract.initialise()

        this.suppyChain.setSmartContract(this.smartContract)
    }

    private updateStatusFromSequence(sequenceItemsByBlock: { blockId: string; items: Blockchain.SequenceStorage.SequenceItem[] }[]) {
        this.messages = []

        for (let idx = 0; idx < sequenceItemsByBlock.length; idx++) {
            let { items } = sequenceItemsByBlock[idx]
            this.messages = this.messages.concat(items)
        }

        this.messages = this.messages.reverse()
    }

    private triggerLoad(branch: string, blockId: string) {
        this.nextLoad = { branch, blockId }
    }

    private async loadState(branch: string, blockId: string) {
        if (this.state && this.state[branch] && this.state[branch].head == blockId)
            return

        let branchState = {
            branch: branch,
            head: blockId,
            headBlock: null
        }

        let blockMetadatas = await this.fullNode.node.blockChainBlockMetadata(blockId, 1)
        let blockMetadata = blockMetadatas && blockMetadatas[0]
        let blockDatas = await this.fullNode.node.blockChainBlockData(blockId, 1)
        let blockData = blockDatas && blockDatas[0]

        branchState.headBlock = { blockMetadata, blockData }

        this.state[branch] = branchState
    }

    private async registerIdentity() {
        let callLater = 1

        if (this.isLoading()) {
            //console.log(`registerIdentity : wait loading finished`)
        }
        else if (!this.user) {
            //console.log(`registerIdentity : wait user presence`)
        }
        else if (!this.hasIdentityContract) {
            //console.log(`registerIdentity : wait identity contract`)
            this.checkIdentityContract()
        }
        else if (!this.registeredOnIdentityContract) {
            //console.log(`registerIdentity : wait identity contract registration`)
            callLater = await this.registerIdentityImpl()
        }
        else if (!this.hasSupplyChainAccount) {
            //console.log(`registerIdentity : wait supply chain account`)
            callLater = await this.registerSupplyChainAccount()
        }
        else {
            this.log(`all done for identity registration`)
            callLater = -1
        }

        if (callLater >= 0)
            setTimeout(() => this.registerIdentity(), 1000 * callLater)
    }

    private checkIdentityContract() {
        this.hasIdentityContract = this.smartContract.hasContract(this.IDENTITY_REGISTRY_CONTRACT_ID)
    }

    private async registerIdentityImpl(): Promise<number> {
        if (!this.user || !this.user.id || !this.user.keys)
            return 1

        if (!this.hasIdentityContract) {
            this.log(`no identity registry contract installed (${this.IDENTITY_REGISTRY_CONTRACT_ID})`)
            return 1
        }

        let identityContractState = this.smartContract.getContractState(this.IDENTITY_REGISTRY_CONTRACT_ID)
        if (!identityContractState) {
            this.log(`no identity contract state`)
            return 1
        }

        if (identityContractState.identities[this.user.id]) {
            this.log(`identity already registered (${this.user.id})`)
            this.registeredOnIdentityContract = true
            return 0
        }

        console.log(`registering identity...`)

        let account = {
            keys: this.user.keys,
            id: this.user.id
        }

        if (! await this.callContract(this.IDENTITY_REGISTRY_CONTRACT_ID, 0, 'registerIdentity', account, {})) {
            this.log(`failed to register identity`)
            return 2
        }

        console.log(`identity registered with id ${account.id}`)
        this.registeredOnIdentityContract = true
        return 1
    }

    private async registerSupplyChainAccount() {
        let account = {
            id: this.user.id,
            keys: this.user.keys
        }

        if (!await this.suppyChain.hasAccount(account.id)) {
            this.log(`registering account on supply chain...`)
            await this.suppyChain.createAccount(account)
            return 1
        }
        else {
            this.log(`already registered on supplychain`)
            this.hasSupplyChainAccount = true
            return 0
        }
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