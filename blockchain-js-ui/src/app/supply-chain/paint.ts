import * as Model from './model'

export function drawPixel(color: string, width: number, height: number, ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = color
    ctx.fillRect(0, 0, width, height)
}

export function drawEmoji(text: string, width: number, height: number, ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = 'black'
    ctx.font = `${Math.min(width, height) * .64}px Verdana`

    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, width / 2, 1.1 * height / 2)
}

export function drawArtWork(state: Model.ProgramState, artWork: Model.ArtWork, width: number, height: number, ctx: CanvasRenderingContext2D) {
    let CW = width / artWork.size.width
    let CH = height / artWork.size.height

    for (let i = 0; i < artWork.size.width; i++) {
        for (let j = 0; j < artWork.size.height; j++) {
            let value = artWork.grid[j * artWork.size.width + i]
            if (value) {
                ctx.save()
                ctx.translate(i * CW, j * CH)
                drawWorkItem(state, value, CW, CH, ctx)
                ctx.restore()
            }
        }
    }
}

export function drawGroupWork(state: Model.ProgramState, groupWork: Model.GroupWork, width: number, height: number, ctx: CanvasRenderingContext2D) {
    const CW = width / groupWork.size.width
    const CH = height / groupWork.size.height
    const PADDING = .5

    ctx.fillStyle = 'lightgrey'
    ctx.fillRect(0, 0, width, height)

    for (let i = 0; i < groupWork.size.width; i++) {
        for (let j = 0; j < groupWork.size.height; j++) {
            ctx.fillStyle = 'white'
            ctx.fillRect(i * CW + PADDING, j * CH + PADDING, CW - 2 * PADDING, CH - 2 * PADDING)

            let value = groupWork.grid[j * groupWork.size.width + i]

            if (value) {
                ctx.save()
                ctx.translate(i * CW + PADDING, j * CH + PADDING)
                drawWorkItem(state, value.workItemId, CW - 2 * PADDING, CH - 2 * PADDING, ctx)
                ctx.restore()
            }
        }
    }
}

export function drawWorkItem(state: Model.ProgramState, id: string, width: number, height: number, ctx: CanvasRenderingContext2D) {
    if (id.startsWith('pixel-')) {
        drawPixel(id.substr('pixel-'.length), width, height, ctx)
    }
    else if (id.startsWith('emoji-')) {
        drawEmoji(id.substr('emoji-'.length), width, height, ctx)
    }
    else if (id.startsWith('artwork-')) {
        drawArtWork(state, state.artWorks[id.substr('artwork-'.length)], width, height, ctx)
    }
    else if (id.startsWith('groupwork-')) {
        drawGroupWork(state, state.groupWorks[id.substr('groupwork-'.length)], width, height, ctx)
    }
}
