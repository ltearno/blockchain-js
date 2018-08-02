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

// from a node, browse blocks reverse and callback for blockId + data item

type StepFactory = (context: IStepContext, ...args) => Promise<any>

interface StepContext {
    nextStepFactory: StepFactory
    nextStepArguments: any[]
}

interface IStepContext {
    [stepName: string]: (...args) => Promise<any>
}

function setNextStep(context: StepContext, nextStepFactory: StepFactory, ...nextStepArguments: any[]) {
    context.nextStepFactory = nextStepFactory
    context.nextStepArguments = nextStepArguments
}

export class SmartContract {
    constructor(
        private node: NodeApi.NodeApi,
        private branch: string,
        private miner: MinerImpl.MinerImpl) { }

    private currentStepContext: StepContext = null

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
        this.executeCurrentStep(this.stepGetNodeHead, null)
    }

    private executeCurrentStep(stepFactory: StepFactory, stepArguments: any[]) {
        let context = {
            nextStepFactory: null,
            nextStepArguments: null
        }

        let stepperObject = this
        let iContext: IStepContext = new Proxy({}, {
            get: function (obj, prop) {
                return (...args) => {
                    if (!stepperObject[prop]) {
                        console.error(`scheduler error: the stepper object does not contain the ${prop.toString()} method`)
                        return
                    }
                    setNextStep(context, stepperObject[prop], ...args)
                }
            }
        })

        this.currentStepContext = context

        if (!stepFactory)
            return

        stepFactory.call(this, ...([iContext].concat(stepArguments))).then(() => {
            console.log(`step ${stepFactory.name} finished`)

            if (this.currentStepContext !== context) {
                console.log(`this step has been abandonned`)
                return
            }

            if (!context.nextStepFactory) {
                console.log(`no more steps`)
                this.currentStepContext = null
                return
            }

            this.executeCurrentStep(context.nextStepFactory, context.nextStepArguments)
        }).catch(error => {
            console.error(`error ${error} step ${stepFactory.name}`)

            if (this.currentStepContext !== context) {
                console.log(`this step has been abandonned`)
                return
            }

            this.currentStepContext = null
        })
    }

    private async stepGetNodeHead(context: IStepContext) {
        let head = await this.node.blockChainHead(this.branch)
        console.log(`loaded node head ${head} ${typeof context}`)

        // go reverse in the blocks to find smart contract informations
        context.stepRecurseBlock(head)
    }

    private async stepRecurseBlock(context: IStepContext, recursedBlock: string) {
        if (!recursedBlock) {
            console.log(`finished reverse browsing blocks`)
            return
        }

        console.log(`recursing from block ${recursedBlock}`)

        let metadata = await this.node.blockChainBlockMetadata(recursedBlock, 1)
        //let data = await this.node.blockChainBlockData(this.recursedBlock, 1)

        console.log(`recursed to block ${metadata[0].blockId}`)

        // read block data and find useful items
        // from those items (in reverse order), build program and program instance states

        context.stepRecurseBlock(metadata && metadata.length && metadata[0].previousBlockIds && metadata[0].previousBlockIds[0])
    }
}