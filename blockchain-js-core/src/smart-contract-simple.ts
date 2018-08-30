import * as NodeApi from './node-api'
import * as MinerImpl from './miner-impl'
import * as HashTools from './hash-tools'
import * as SequenceStorage from './sequence-storage'

/**
 * THIS IMPLEMENTATION DOES NOT ALLOW CONTRACT TO CALL OTHER CONTRACTS, SO IT IS DEPRECATED
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

export class SmartContract {
    private contractItemList: SequenceStorage.SequenceStorage
    private registeredChangeListener: SequenceStorage.SequenceChangeListener

    private latestInstanceState = {}

    constructor(
        private node: NodeApi.NodeApi,
        private branch: string,
        private contractUuid: string,
        private miner: MinerImpl.MinerImpl) { }

    initialise() {
        this.contractItemList = new SequenceStorage.SequenceStorage(this.node, this.branch, `smart-contract-${this.contractUuid}`, this.miner)
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

        console.log(`updating smart contract status because sequence item has changed`)

        let contractPublicKey = null
        let currentContractIterationId = -1

        let contractIterations = []
        let instanceData = {}

        for (let contractItem of contractItems) {
            switch (contractItem['type']) {
                case 'contract': {
                    let iterationId = currentContractIterationId + 1

                    console.log(`Iteration ${iterationId}`)

                    let packedDescription = contractItem['data']
                    if (!packedDescription) {
                        console.error(`no packed description found for smart contract`)
                        continue
                    }

                    if (contractPublicKey && contractPublicKey != HashTools.extractPackedDataPublicKey(packedDescription)) {
                        console.error(`iteration does use an incorrect public key`)
                    }

                    if (!HashTools.verifyPackedData(packedDescription)) {
                        console.error(`packed description is invalid regarding signature`)
                        continue
                    }

                    contractIterations[iterationId] = {
                        description: packedDescription,
                        liveInstance: this.createLiveInstance(HashTools.extractPackedDataBody(packedDescription).code)
                    }

                    currentContractIterationId = iterationId
                    if (!contractPublicKey)
                        contractPublicKey = HashTools.extractPackedDataPublicKey(packedDescription)

                    /*console.log(`public key : ${HashTools.extractPackedDataPublicKey(packedDescription).substr(0, 15)}`)
                    console.log(`signature  : ${HashTools.extractPackedDataSignature(packedDescription)}`)
                    console.log(`description:`)
                    console.log(JSON.stringify(HashTools.extractPackedDataBody(packedDescription), null, 4))*/

                    // call init on live instance (if init method is present)
                    // This is the opportunity for the contract to upgrade its data structure : never will it be called again with the previous iteration
                    let liveInstance = contractIterations[iterationId].liveInstance
                    if ('init' in liveInstance) {
                        console.log(`initializing instance ${iterationId}`)
                        liveInstance['init'].apply(instanceData)
                    }
                } break

                case 'call': {
                    const { iterationId, method, args } = contractItem['data']

                    if (iterationId != currentContractIterationId) {
                        console.warn(`cannot execute call targetting iteration ${iterationId}, current iteration is ${currentContractIterationId}`)
                        continue
                    }

                    let liveInstance = contractIterations[iterationId].liveInstance
                    if (!(method in liveInstance)) {
                        console.warn(`cannot apply call, because method ${method} does not exist`)
                        continue
                    }

                    // TODO do parameter validation

                    try {
                        console.log(`applying call to method ${method} of smart contract with params ${JSON.stringify(args)}`)
                        liveInstance[method].apply({
                            data: instanceData
                        }, [args])
                    }
                    catch (error) {
                        console.warn('error while executing smart contract code', error)
                    }

                    //console.log(`instance resolved state: ${JSON.stringify(instanceData, null, 2)}`)
                } break

                default:
                    console.log(`ignored contract item ${JSON.stringify(contractItem)}`)
            }
        }

        console.log(`instance resolved state: ${JSON.stringify(instanceData, null, 2)}`)
        this.latestInstanceState = instanceData
    }

    getLatestContractState() {
        return this.latestInstanceState
    }

    async displayStatus() {
        console.log(`== Smart contract status : ${this.contractUuid}`)

        console.log(`Instance state : ${JSON.stringify(this.latestInstanceState, null, 4)}`)
    }

    private createLiveInstance(code: string) {
        let instanceSandbox = {
            console: {
                log: (text) => console.log(`### SMART CONTRACT LOG: ${text}`),
                warn: (text) => console.warn(`### SMART CONTRACT WARNING: ${text}`),
                error: (text) => console.error(`### SMART CONTRACT ERROR: ${text}`)
            }
        }

        try {
            code = 'with (sandbox) { return (' + code + ') }'
            const codeFunction = new Function('sandbox', code)

            return function (sandbox) {
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
        }
        catch (error) {
            return null
        }
    }

    async tryCreateContract(privateKey: string, name: string, description: string, code: string) {
        let signedContractDescription = HashTools.signAndPackData({
            name,
            description,
            code
        }, privateKey)

        return this.contractItemList.addItems([{
            type: 'contract',
            data: signedContractDescription
        }])
    }

    async callContract(iterationId: number, method: string, args: object) {
        // TODO have a way to add items in the same block (en effet en l'etat actuel, un seul item par bloc va passer, car un item référence l'item précédent...)
        return this.contractItemList.addItems([{
            type: 'call',
            data: {
                iterationId,
                method,
                args
            }
        }])
    }
}