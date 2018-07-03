import * as Block from './block'
import * as NodeApi from './node-api'
import * as MinerImpl from './miner-impl'

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
 * - signed calls : sig(pubKey, programInstanceId, parameters)
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

// from a node, browse blocks reverse and callback for blockId + data item

export class SmartContract {
    constructor(
        private node: NodeApi.NodeApi,
        private branch: string,
        private miner: MinerImpl.MinerImpl) { }

    private stepPromiseFactory: () => Promise<any>
    private lastPromiseContext: {} = null

    private nodeListener = () => this.updateFromNode()

    initialise() {
        this.node.addEventListener('head', this.nodeListener)
        this.updateFromNode()
    }

    terminate() {
        this.node.removeEventListener(this.nodeListener)
        this.node = undefined
    }

    async addProgram(id: string, pubKey: string, code: string) {
    }

    async updateProgram(newId: string, oldId: string, sig: string, code: string) {
    }

    async deleteProgram(id: string, sig: string) {
    }

    // returns the instance id (a guid)
    async createProgramInstance(programId: string, args: object, pubKey: string) {
        return ""
    }

    async deleteProgramInstance(programId: string, sig: string) {
    }

    // return a data that is used to call the program
    async dataItemForCall(programId: string, args: object) {
        return null
    }

    private async updateFromNode() {
        this.stepPromiseFactory = this.stepGetNodeHead
        this.executeCurrentStep()
    }

    private executeCurrentStep() {
        let context = {}
        this.lastPromiseContext = context

        if (!this.stepPromiseFactory)
            return

        let stepPromiseFactory = this.stepPromiseFactory
        this.stepPromiseFactory = null

        stepPromiseFactory.call(this).then(result => {
            if (this.lastPromiseContext !== context) {
                console.log(`abandonned step result`)
                return
            }

            console.log(`step accomplished ! ${result}`)
            if (!this.stepPromiseFactory)
                console.log(`no more steps`)
            else
                this.executeCurrentStep()
        }).catch(error => {
            if (this.lastPromiseContext !== context) {
                console.log(`abandonned step error ${error}`)
                return
            }

            console.error(`step error: ${error}`)
            this.stepPromiseFactory = null
        })
    }

    private head: string = null

    private async stepGetNodeHead() {
        this.head = await this.node.blockChainHead(this.branch)
        console.log(`loaded node head ${this.head}`)

        // go reverse in the blocks to find smart contract informations
        this.stepPromiseFactory = this.stepRecurseBlock
        this.recursedBlock = this.head
    }

    private recursedBlock: string

    private async stepRecurseBlock() {
        if (!this.recursedBlock) {
            console.log(`finished reverse browsing blocks`)
            return
        }

        let metadata = await this.node.blockChainBlockMetadata(this.recursedBlock, 1)
        //let data = await this.node.blockChainBlockData(this.recursedBlock, 1)

        console.log(`recursed to block ${metadata[0].blockId}`)

        this.stepPromiseFactory = this.stepRecurseBlock
        this.recursedBlock = metadata && metadata.length && metadata[0].previousBlockIds && metadata[0].previousBlockIds[0]
    }
}