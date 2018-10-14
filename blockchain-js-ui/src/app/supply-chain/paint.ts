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
    const CW = width / artWork.size.width
    const CH = height / artWork.size.height
    const PADDING = 0//.5

    for (let i = 0; i < artWork.size.width; i++) {
        for (let j = 0; j < artWork.size.height; j++) {
            let value = artWork.grid[j * artWork.size.width + i]

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
}

export function drawCell(artWork: Model.ArtWork, i: number, j: number, width: number, height: number, ctx: CanvasRenderingContext2D) {
    const CW = width / artWork.size.width
    const CH = height / artWork.size.height

    ctx.fillStyle = 'lightgrey'
    ctx.fillRect(i * CW, j * CH, CW, CH)
}

export function clear(width: number, height: number, ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = 'white'
    ctx.fillRect(0, 0, width, height)
}