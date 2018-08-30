import * as NodeApi from './node-api'
import * as MinerImpl from './miner-impl'
import * as HashTools from './hash-tools'
import * as SequenceStorage from './sequence-storage'

/**
 * TODO :
 * - options on contracts : can other read state ? can be updated ? list of pubKeys for changing the contract...
 * 
 * This should implement basic smart contract functionality :
 * 
 * - recognize and sort-up data in the blockchain (only those with certain field values, and which are consistent...)
 * - has its own data-structure
 * 
 * - stores programs with an id, author's pubKey and a code in js (maybe list of parameters etc)
 * - can instantiate a program = allocating memory and initial parameters for an execution of it
 * - the program has : execution, memory and i/o model
 * - execution is js and is sandboxed. Also a basic block navigation API is provided
 * - memory is js (memory is ephemeral and dies after the call)
 * - i/o is :
 *   - inputs : program instance data, call parameters and blocks, 
 *   - outputs : add data to the chain => yes as long as idempotent => produced data must keyed by the smart contract (and of course it cannot use random number generation)
 * - allows to get data that should be added in the chain to call a program
 * 
 * - api to retreive any program state data
 * 
 * - signed calls : sig(pubKey, programInstanceId, parameters), targetting a *precise* version of the contract
 * 
 * - allows to update a program by signing its previous version with the same private key
 * 
 * - program api: create update delete, options : can instances be created without a sig ?
 * - instance api: lifecycle=init_memory, methods
 * 
 * Think about key renewal...
 */

/**
 * Program execution :
 * 
 * can lead to a result or an error, if error then the call is invalid and not counted
 */

/**
 * browse blocks and :
 * 
 * filter block data for smart contract related data
 * construct program instances and update their state
 */

interface ContractState {
    name: string
    description: string
    contractPublicKey: string
    currentContractIterationId: number
    contractIterations: {
        description: any
        liveInstance: any
    }[]
    instanceData: any
}

export class SmartContract {
    private contractItemList: SequenceStorage.SequenceStorage
    private registeredChangeListener: SequenceStorage.SequenceChangeListener

    constructor(
        private node: NodeApi.NodeApi,
        private branch: string,
        private miner: MinerImpl.MinerImpl) { }

    initialise() {
        this.contractItemList = new SequenceStorage.SequenceStorage(this.node, this.branch, `smart-contract-v1`, this.miner)
        this.contractItemList.initialise()

        this.registeredChangeListener = sequenceItems => this.updateStatusFromSequence(sequenceItems)
        this.contractItemList.addEventListener('change', this.registeredChangeListener)
    }

    terminate() {
        this.contractItemList.removeEventListener(this.registeredChangeListener)
        this.contractItemList.terminate()
        this.node = undefined
    }

    private updateStatusFromSequence(contractItems: SequenceStorage.SequenceItem[]) {
        if (!contractItems || !contractItems.length) {
            console.log(`empty contract...`)
            return
        }

        console.log(`updating smart contracts statuses because sequence item has changed`)

        let contracts = new Map<string, ContractState>()

        for (let contractItem of contractItems) {
            switch (contractItem['type']) {
                case 'contract': {
                    let packedDescription = contractItem['data']
                    if (!packedDescription) {
                        console.error(`no packed description found for smart contract, ignoring item ${JSON.stringify(contractItem)}`)
                        continue
                    }

                    if (!HashTools.verifyPackedData(packedDescription)) {
                        console.error(`packed description signature is invalid, ignoring ${JSON.stringify(contractItem)}`)
                        continue
                    }

                    let contractDescription = HashTools.extractPackedDataBody(packedDescription)
                    let contractUuid = contractDescription.uuid

                    // retrieve or create the contract state
                    let contractState: ContractState = null
                    if (contracts.has(contractUuid)) {
                        contractState = contracts.get(contractUuid)

                        contractState.name = contractDescription.name
                        contractState.description = contractDescription.description
                    }
                    else {
                        contractState = {
                            contractPublicKey: null,
                            currentContractIterationId: -1,
                            contractIterations: [],
                            instanceData: {},
                            name: contractDescription.name,
                            description: contractDescription.description
                        }

                        contracts.set(contractUuid, contractState)
                    }

                    let iterationId = contractState.currentContractIterationId + 1
                    console.log(`Contract ${contractUuid}, iteration ${iterationId}`)

                    if (contractState.contractPublicKey && contractState.contractPublicKey != HashTools.extractPackedDataPublicKey(packedDescription)) {
                        console.error(`iteration does use an incorrect public key`)
                    }

                    contractState.contractIterations[iterationId] = {
                        description: packedDescription,
                        liveInstance: this.createLiveInstance(contractDescription.uuid, iterationId, contractDescription.code, contracts)
                    }

                    contractState.currentContractIterationId = iterationId
                    if (!contractState.contractPublicKey)
                        contractState.contractPublicKey = HashTools.extractPackedDataPublicKey(packedDescription)

                    /*console.log(`public key : ${HashTools.extractPackedDataPublicKey(packedDescription).substr(0, 15)}`)
                    console.log(`signature  : ${HashTools.extractPackedDataSignature(packedDescription)}`)
                    console.log(`description:`)
                    console.log(JSON.stringify(HashTools.extractPackedDataBody(packedDescription), null, 4))*/

                    // call init on live instance (if init method is present)
                    // This is the opportunity for the contract to upgrade its data structure : never will it be called again with the previous iteration
                    let liveInstance = contractState.contractIterations[iterationId].liveInstance
                    if ('init' in liveInstance) {
                        let callSuccess = this.callContractInstance('init', undefined, liveInstance, contractState)
                        if (!callSuccess) {
                            console.error(`error when initializing contract ${contractUuid}, caused by item ${JSON.stringify(contractItem)}`)
                            continue
                        }
                    }
                    else {
                        console.warn(`no init method on contract ${contractUuid} for iteration ${iterationId}, ignore`)
                    }
                } break

                case 'call': {
                    const { contractUuid, iterationId, method, args } = contractItem['data']

                    if (method == 'init') {
                        console.error(`cannot call the init method (caused by ${JSON.stringify(contractItem)})`)
                        continue
                    }

                    let contractState: ContractState = contracts.get(contractUuid)
                    if (!contractState) {
                        console.error(`cannot call a contract without state, ignoring. ${JSON.stringify(contractItem)}`)
                        continue
                    }

                    // check that iterationId is the last one on the contract.
                    // or ignore it if iterationId is undefined
                    if (iterationId !== undefined && iterationId != contractState.currentContractIterationId) {
                        console.warn(`cannot execute call targetting iteration ${iterationId}, current iteration is ${contractState.currentContractIterationId}`)
                        continue
                    }

                    let liveInstance = contractState.contractIterations[iterationId].liveInstance
                    if (!(method in liveInstance)) {
                        console.warn(`cannot apply call, because method ${method} does not exist`)
                        continue
                    }

                    // TODO do parameter validation

                    let callSuccess = this.callContractInstance(method, args, liveInstance, contractState)
                    if (!callSuccess) {
                        console.error(`error when calling ${method} on contract ${contractUuid}, caused by item ${JSON.stringify(contractItem)}`)
                        continue
                    }
                } break

                default:
                    console.log(`ignored contract item ${JSON.stringify(contractItem)}`)
            }
        }

        for (let [contractUuid, state] of contracts.entries()) {
            console.log(``)
            console.log(`Smart contract ${contractUuid}, current iteration : ${state.currentContractIterationId}`)
            console.log(` pubKey : ${state.contractPublicKey.substr(0, 20)}`)
            console.log(`instance resolved state: ${JSON.stringify(state.instanceData, null, 2)}`)
        }
    }

    private callContractInstance(method: string, args: any, liveInstance: any, contractState: ContractState) {
        if (!(method in liveInstance)) {
            console.error(`method ${method} does not exist on contract, cannot apply`)
            return false
        }

        console.log(`applying call to method ${method} of smart contract with params ${JSON.stringify(args)}`)

        let backup = JSON.stringify(contractState.instanceData)

        try {
            liveInstance[method].apply({
                data: contractState.instanceData
            }, [args])
        }
        catch (error) {
            console.warn('error while executing smart contract code, reverting changes', error)

            contractState.instanceData = JSON.parse(backup)

            return false
        }

        return true
    }

    private createLiveInstance(contractUuid: string, iterationId: number, code: string, contracts: Map<string, ContractState>) {
        let liveInstance = null

        let instanceSandbox = {
            JSON,

            console: {
                log: (text) => console.log(`### SMART CONTRACT ${contractUuid}@${iterationId} LOG: ${text}`),
                warn: (text) => console.warn(`### SMART CONTRACT ${contractUuid}@${iterationId} WARNING: ${text}`),
                error: (text) => console.error(`### SMART CONTRACT ${contractUuid}@${iterationId} ERROR: ${text}`)
            },

            stateOfContract: (uuid) => {
                if (!liveInstance)
                    throw 'no live instance, are you trying to do something weird?'

                let contractState = contracts.get(uuid)
                if (!contractState) {
                    console.warn(`contract ${contractUuid} asked for state of an unknown contract (${uuid})`)
                    return null
                }

                console.log(`contract ${contractUuid} asked for state of contract (${uuid})`)

                // make a clone, so that contract cannot alter the other instance's data
                return JSON.parse(JSON.stringify(contractState.instanceData))
            },

            callContract: (uuid, iterationId, method, args) => {
                if (!liveInstance)
                    throw 'no live instance, are you trying to do something weird?'

                let contractState = contracts.get(uuid)
                if (!contractState) {
                    console.error(`contract ${contractUuid} asked for calling method ${method} on an unknown contract (${uuid}@${iterationId})`)
                    return false
                }

                this.callContractInstance(method, args, contractState.contractIterations[contractState.currentContractIterationId].liveInstance, contractState)
            }
        }

        try {
            code = 'with (sandbox) { return (' + code + ') }'
            const codeFunction = new Function('sandbox', code)

            liveInstance = function (sandbox) {
                const sandboxProxy = new Proxy(sandbox, {
                    has: () => true,
                    get: (target, key) => {
                        if (key === Symbol.unscopables)
                            return undefined
                        return target[key]
                    }
                })

                return codeFunction(sandboxProxy)
            }(instanceSandbox)

            return liveInstance
        }
        catch (error) {
            return null
        }
    }

    async publishContract(privateKey: string, uuid: string, name: string, description: string, code: string) {
        let signedContractDescription = HashTools.signAndPackData({
            uuid,
            name,
            description,
            code
        }, privateKey)

        return this.contractItemList.addItems([{
            type: 'contract',
            data: signedContractDescription
        }])
    }

    async callContract(contractUuid: string, iterationId: number, method: string, args: object = null) {
        // TODO have a way to add items in the same block (en effet en l'etat actuel, un seul item par bloc va passer, car un item référence l'item précédent...)
        return this.contractItemList.addItems([{
            type: 'call',
            data: {
                contractUuid,
                iterationId,
                method,
                args
            }
        }])
    }
}