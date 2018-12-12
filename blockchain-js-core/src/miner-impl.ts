import * as Block from './block'
import * as NodeApi from './node-api'
import * as MinerApi from './miner-api'
import * as MiniObservable from './mini-observable'

const unifiedNow = typeof performance !== 'undefined' ? () => performance.now() : () => Date.now()

export class MinerImpl implements MinerApi.MinerApi {
    private dataToMineByBranch = new Map<string, any[]>()

    private mineTrigger = new MiniObservable.SimpleEventEmitter<void>()

    constructor(private node: NodeApi.NodeApi) {
        this.mineTrigger.subscribe(_ => this.mineData())
    }

    private getToMineList(branch: string) {
        if (!this.dataToMineByBranch.has(branch))
            this.dataToMineByBranch.set(branch, [])
        return this.dataToMineByBranch.get(branch)
    }

    // add data to miner's mempool
    addData(branch: string, data: any): void {
        this.getToMineList(branch).push(data)
        this.mineTrigger.emit(null)
    }

    /**
     * returns the number of mined blocks and errors occured
     * 
     * @param difficulty difficulty at wich mining is to be made.
     * 
     * TODO should be able to create a merge block
     */
    async mineData(difficulty: number = 6, batchSize: number = -1): Promise<{ nbMinedBlocks: number, errors: any[] }> {
        if (!this.dataToMineByBranch.size)
            return { nbMinedBlocks: 0, errors: [] }

        let dataToMineByBranch = this.dataToMineByBranch
        this.dataToMineByBranch = new Map()

        let minedBlockIds = []
        let errors = []

        let startTime = unifiedNow()
        //console.log("START MINING")

        for (let [branch, dataToMine] of dataToMineByBranch.entries()) {
            if (!dataToMine.length)
                continue

            let head = await this.node.blockChainHead(branch)
            if (head) {
                let metadata = (await this.node.blockChainBlockMetadata(head, 1))[0]
                if (!metadata) {
                    errors.push(`error, cannot fetch node's head metadata`)
                    // put the data back in the mining pool
                    this.dataToMineByBranch.set(branch, dataToMine)
                    continue
                }
            }

            //console.log(`mining this data ${JSON.stringify(dataToMine)}`)

            let preBlock = Block.createBlock(branch, [head], dataToMine)
            let block = await Block.mineBlock(preBlock, difficulty, batchSize)

            let blockId = await Block.idOfBlock(block)

            //console.log(`mined block ${blockId.substring(0, 5)}`)

            await this.node.registerBlock(blockId, block)

            minedBlockIds.push(blockId)
        }

        let endTime = unifiedNow()

        console.log(`mining time: ${endTime - startTime}, mined blocks : ${minedBlockIds.map(id => id.substr(0, 5)).join()}`)

        return { nbMinedBlocks: minedBlockIds.length, errors }
    }
}