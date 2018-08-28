import * as Block from './block'
import * as NodeApi from './node-api'
import * as MinerImpl from './miner-impl'
import * as KeyValueStorage from './key-value-storage'
import * as HashTools from './hash-tools'
import * as ListOnChain from './list-on-chain'

/**
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
    private kv: KeyValueStorage.KeyValueStorage
    private callList: ListOnChain.ListOnChain

    constructor(
        private node: NodeApi.NodeApi,
        private branch: string,
        private contractUuid: string,
        private miner: MinerImpl.MinerImpl) { }

    initialise() {
        this.kv = new KeyValueStorage.KeyValueStorage(this.node, Block.MASTER_BRANCH, `kv-sm-${this.contractUuid}`, this.miner)
        this.kv.initialise()

        this.callList = new ListOnChain.ListOnChain(this.node, this.branch, `smart-contract-${this.contractUuid}`, this.miner)
        this.callList.initialise()
    }

    terminate() {
        this.callList.terminate()

        this.kv.terminate()

        this.node = undefined
    }

    async displayStatus() {
        console.log(`== Smart contract status : ${this.contractUuid}`)

        // definitions
        let iterationsKeys = this.kv.keys(`/iterations/`)
        if (!iterationsKeys) {
            console.log(`empty contract, come back later...`)
            return
        }

        let contractIterations = []
        contractIterations.fill(null, 0, iterationsKeys.length)

        // TODO : check that all iterations have got the SAME PUBLIC KEY
        for (let iterationKey of iterationsKeys) {
            let iterationId = parseInt(iterationKey.substr(1 + iterationKey.lastIndexOf('/')))

            console.log(`Iteration ${iterationId} ${iterationKey}`)

            let packedDescription = this.kv.get(iterationKey)
            if (!packedDescription) {
                console.error(`no packed description found for smart contract`)
                return
            }

            if (!HashTools.verifyPackedData(packedDescription)) {
                console.log(`packed description is invalid regarding signature`)
                return
            }

            contractIterations[iterationId] = {
                description: packedDescription,
                liveInstance: this.createLiveInstance(HashTools.extractPackedDataBody(packedDescription).code)
            }

            console.log(`public key : ${HashTools.extractPackedDataPublicKey(packedDescription).substr(0, 15)}`)
            console.log(`signature  : ${HashTools.extractPackedDataSignature(packedDescription)}`)
            console.log(`description:`)
            console.log(JSON.stringify(HashTools.extractPackedDataBody(packedDescription), null, 4))
        }

        // calls
        let calls = this.callList.getList()
        console.log(`calls :`)
        calls.forEach(call => console.log(JSON.stringify(call, null, 2)))

        // simulate calls
        console.log(`executing in VM :`)
        // TODO prevent calls on obsolete iterations (so we need to order iterations and calls...)
        let instanceData = {}
        for (let { iterationId, method, args } of calls) {
            let instance = contractIterations[iterationId].liveInstance
            if (!(method in instance)) {
                console.log(`cannot apply call, because method ${method} does not exist`)
                continue
            }

            // TODO do parameter validation

            try {
                console.log(`applying call to method ${method} of smart contract with params ${JSON.stringify(args)}`)
                instance[method].apply(instanceData, args)
                console.log(`done executing method on smart contract, contract state is now ${JSON.stringify(instanceData)}`)
            }
            catch (error) {
                console.error('error while executing smart contract code', error)
            }
        }
        console.log(`instance initial data: ${JSON.stringify(instanceData, null, 2)}`)
    }

    private createLiveInstance(code: string) {
        function has(target, key) {
            return true
        }

        function get(target, key) {
            if (key === Symbol.unscopables) return undefined
            return target[key]
        }

        try {
            code = 'with (sandbox) { return (' + code + ') }'
            const codeFunction = new Function('sandbox', code)

            return function (sandbox) {
                const sandboxProxy = new Proxy(sandbox, { has, get })
                return codeFunction(sandboxProxy)
            }({ console })
        }
        catch (error) {
            return null
        }
    }

    private createLiveInstanceOld(code: string) {
        let bannedKeywords = ['document', 'window', 'os']

        let program = new Function(`
            //if(typeof process != "undefined") {
            //    process = {
            //        _tickCallback: process._tickCallback
            //    }
            //}

            ${bannedKeywords.map(kw => `if(typeof ${kw} != "undefined") ${kw} = undefined;`).join('\n')}

            return (
            // user's smart contract
            ${code}
            )
        `)

        console.log(`program instance creation`)
        let instance = program.apply(null)
        if (typeof instance != "object") {
            console.error(`ERROR not an object !`)
            return null
        }

        return instance
    }

    async tryCreateContract(iterationId: number, privateKey: string, name: string, description: string, code: string) {
        // from the specs
        // /smartcontracts/CONTRACT_UUID/ITERATION_ID/code : javascript code of the smart contract
        // /smartcontracts/CONTRACT_UUID/ITERATION_ID/publicKey : public key of the contract owner
        // /smartcontracts/CONTRACT_UUID/ITERATION_ID/sig : signature of the contract (should match the publick key)
        let signedContractDescription = HashTools.signAndPackData({
            name,
            description,
            code
        }, privateKey)

        this.kv.put(`/iterations/${iterationId}`, signedContractDescription, this.miner)
    }

    // make a call to the smart contract
    async callContract(iterationId: number, method: string, args: object) {
        return this.callList.addToList([{
            iterationId,
            method,
            args
        }])
    }
}