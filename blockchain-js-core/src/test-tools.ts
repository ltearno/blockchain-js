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