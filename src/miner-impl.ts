import * as Block from './block'
import * as NodeApi from './node-api'

export class MinerImpl {
    private dataToMine = []
    private scheduled = false
    private reschedule = false

    constructor(private node: NodeApi.NodeApi) { }

    addData(data: any): void {
        this.dataToMine.push(data)
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
        if (!this.dataToMine.length)
            return

        let head = await this.node.blockChainHead()
        let difficuly = 1
        if (head) {
            let metadata = (await this.node.blockChainBlockMetadata(head, 1))[0]
            if (!metadata)
                throw `error, cannot fetch node's head metadata`

            difficuly = metadata.target.validityProof.difficulty
        }

        let dataToMine = this.dataToMine
        this.dataToMine = []

        let preBlock = Block.createBlock(head, dataToMine)
        let block = await Block.mineBlock(preBlock, difficuly)

        let metadata = await this.node.registerBlock(block)

        console.log(`mined block ${metadata.blockId.substring(0, 5)}`)
    }
}