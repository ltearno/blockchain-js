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

    addData(branch: string, data: any): void {
        this.getToMineList(branch).push({ branch, data })
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
        }, 0)
    }

    async mineData() {
        let dataToMineByBranch = this.dataToMineByBranch
        this.dataToMineByBranch = new Map()

        for (let entry of dataToMineByBranch.entries()) {
            let branch = entry[0]
            let dataToMine = entry[1]

            if (!dataToMine.length)
                return

            let head = await this.node.blockChainHead(branch)
            let difficuly = 1
            if (head) {
                let metadata = (await this.node.blockChainBlockMetadata(head, 1))[0]
                if (!metadata)
                    throw `error, cannot fetch node's head metadata`

                difficuly = metadata.target.validityProof.difficulty
            }

            let preBlock = Block.createBlock(branch, head, dataToMine)
            let block = await Block.mineBlock(preBlock, difficuly)

            let metadata = await this.node.registerBlock(block)

            console.log(`mined block ${metadata.blockId.substring(0, 5)}`)
        }
    }
}