import * as Block from './block'
import * as NodeApi from './node-api'

export class MinerImpl {
    private dataToMineByBranch = new Map<string, any[]>()
    private scheduled = false
    private reschedule = false

    constructor(private node: NodeApi.NodeApi) { }

    private getToMineList(branch: string) {
        if (!this.dataToMineByBranch.has(branch))
            this.dataToMineByBranch.set(branch, [])
        return this.dataToMineByBranch.get(branch)
    }

    // add data to miner's mempool
    addData(branch: string, data: any): void {
        this.getToMineList(branch).push(data)
        this.schedule()
    }

    // if already executing, mark as to redo when finish
    // otherwise, schedule next operation
    private schedule() {
        if (this.scheduled) {
            this.reschedule = true
            return
        }

        this.scheduled = true
        setTimeout(() => {
            this.mineData().then(() => {
                this.scheduled = false
                if (this.reschedule) {
                    this.reschedule = false
                    this.schedule()
                }
            })
        }, 500)
    }

    /**
     * returns the number of mined blocks and errors occured
     * 
     * @param difficulty difficulty at wich mining is to be made.
     * 
     * TODO should be able to create a merge block
     */
    async mineData(difficulty: number = 10, batchSize: number = -1): Promise<{ nbMinedBlocks: number, errors: any[] }> {
        if (!this.dataToMineByBranch.size)
            return { nbMinedBlocks: 0, errors: [] }

        let dataToMineByBranch = this.dataToMineByBranch
        this.dataToMineByBranch = new Map()

        let nbMinedBlocks = 0
        let errors = []

        let startTime = Date.now()
        console.log("START MINING")

        for (let entry of dataToMineByBranch.entries()) {
            let branch = entry[0]
            let dataToMine = entry[1]

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

            console.log(`mined block ${blockId.substring(0, 5)}`)

            let metadata = await this.node.registerBlock(blockId, block)

            nbMinedBlocks++
        }

        let endTime = Date.now()

        console.log(`MINING TIME: ${endTime - startTime}, mined blocks : ${nbMinedBlocks}`)

        return { nbMinedBlocks, errors }
    }
}