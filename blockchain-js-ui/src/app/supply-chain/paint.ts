import * as Model from './model'

export function drawPixel(color: string, width: number, height: number, ctx: CanvasRenderingContext2D) {
    const MARGIN = width / 15

    ctx.fillStyle = color
    //ctx.fillRect(0, 0, width, height)

    ctx.strokeStyle = color
    ctx.lineJoin = "round"
    ctx.lineWidth = width / 8
    ctx.beginPath()
    ctx.moveTo(MARGIN, MARGIN)
    ctx.lineTo(width - MARGIN - 1, MARGIN)
    ctx.lineTo(width - MARGIN - 1, height - MARGIN - 1)
    ctx.lineTo(MARGIN, height - MARGIN - 1)
    ctx.lineTo(MARGIN, MARGIN)
    ctx.closePath()
    ctx.stroke()
    ctx.fill()
}

export function drawEmoji(text: string, width: number, height: number, ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = 'black'
    ctx.font = `${Math.min(width, height) * .64}px Verdana`

    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, width / 2, 1.1 * height / 2)
}

export function drawArtWork(state: Model.ProgramState, artWork: Model.ArtWork, width: number, height: number, ctx: CanvasRenderingContext2D) {
    if (!artWork || !artWork.grid)
        return

    const CW = width / artWork.size.width
    const CH = height / artWork.size.height

    for (let i = 0; i < artWork.size.width; i++) {
        for (let j = 0; j < artWork.size.height; j++) {
            let value = artWork.grid[j * artWork.size.width + i]

            if (value) {
                ctx.save()
                ctx.translate(i * CW, j * CH)
                drawWorkItem(state, value.workItemId, CW, CH, ctx)
                if (!value.ownerId) {
                    ctx.beginPath()
                    ctx.strokeStyle = 'rgba(0,0,0,.4)'
                    ctx.lineWidth = CW / 5
                    ctx.moveTo(0, 0)
                    ctx.lineTo(CW - 1, CH - 1)
                    ctx.moveTo(CW - 1, 0)
                    ctx.lineTo(0, CH - 1)
                    ctx.stroke()
                }
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
    const MARGIN = CW / 20

    ctx.fillStyle = 'rgba(0,0,0,.2)'
    ctx.fillRect(i * CW - MARGIN, j * CH - MARGIN, CW + 2 * MARGIN, CH + 2 * MARGIN)
}

export function clear(width: number, height: number, ctx: CanvasRenderingContext2D) {
    if (!ctx)
        return

    ctx.fillStyle = 'white'
    ctx.fillRect(0, 0, width, height)
}