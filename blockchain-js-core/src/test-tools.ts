import * as Block from './block'

export function createSimpleMiner(branch: string, previousBlockId: string, difficulty: number) {
    return async function () {
        let block = Block.createBlock(branch, [previousBlockId], [{ nom: "arnaud" }])

        let minedBlock = await Block.mineBlock(block, difficulty)

        previousBlockId = await Block.idOfBlock(minedBlock)

        console.log(`mined block ${previousBlockId.substring(0, 5)}`)
        return { id: previousBlockId, block: minedBlock }
    }
}

export function wait(duration: number) {
    return new Promise((resolve, reject) => {
        setTimeout(() => resolve(), duration)
    })
}

export class CallSerializer {
    constructor(private callback: (data) => Promise<any>) { }

    private _processing = false
    private _hasNext = false
    private _nextData = null

    pushData(data: any = null) {
        this._hasNext = true
        this._nextData = data

        this.trigger()
    }

    private trigger() {
        if (!this._hasNext)
            return

        if (!this._processing)
            this.processCall()
    }

    private async processCall() {
        let data = this._nextData
        this._nextData = null
        this._hasNext = false

        this._processing = true

        await this.callback(data)
        await wait(1)

        this._processing = false

        this.trigger()
    }
}