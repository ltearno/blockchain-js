import * as Block from './block'

export function createSimpleMiner(previousBlockId: string, difficulty: number) {
    return async function () {
        console.log(`block creation`)
        let block = Block.createBlock(previousBlockId, [{ nom: "arnaud" }])

        console.log(`mining block`)
        let minedBlock = await Block.mineBlock(block, difficulty)

        previousBlockId = await Block.idOfBlock(minedBlock)

        console.log(`mined block ${previousBlockId}`)
        return minedBlock
    }
}

export function wait(duration: number) {
    return new Promise((resolve, reject) => {
        setTimeout(() => resolve(), duration)
    })
}