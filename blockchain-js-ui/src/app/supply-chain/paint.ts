import * as Model from './model'
import { CANVAS_BASE_WIDTH, CANVAS_BASE_HEIGHT } from '../constants'

const USE_BACK_CACHE = true

interface BackBuffer {
    canvas: HTMLCanvasElement
    ctx: CanvasRenderingContext2D
}

let backCanvasMap = new Map<string, BackBuffer>()

export function setSmartProgram(smartContract) {
    smartContract.addChangeListener(() => resetCache())
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

    ctx.clearRect(0,0,width,height)
}

function resetCache() {
    backCanvasMap.clear()
}

export function drawWorkItem(state: Model.ProgramState, id: string, width: number, height: number, ctx: CanvasRenderingContext2D, disablePaintCache: boolean = false) {
    drawWorkItemInternal(state, id, width, height, ctx, disablePaintCache)
}

function drawWorkItemInternal(state: Model.ProgramState, id: string, width: number, height: number, ctx: CanvasRenderingContext2D, disablePaintCache: boolean) {
    if (id.startsWith('pixel-')) {
        drawPixel(id.substr('pixel-'.length), width, height, ctx)
    }
    else if (id.startsWith('emoji-')) {
        drawEmoji(id.substr('emoji-'.length), width, height, ctx)
    }
    else if (id.startsWith('artwork-')) {
        drawArtWork(state, id.substr('artwork-'.length), width, height, ctx, disablePaintCache)
    }
}

export function drawArtWork(state: Model.ProgramState, artWorkId: string, width: number, height: number, ctx: CanvasRenderingContext2D, disablePaintCache: boolean = false) {
    if (USE_BACK_CACHE && !disablePaintCache) {
        if (backCanvasMap.has(artWorkId)) {
            ctx.drawImage(backCanvasMap.get(artWorkId).canvas, 0, 0, CANVAS_BASE_WIDTH, CANVAS_BASE_HEIGHT, 0, 0, width, height)
        }
        else {
            // create back canvas
            let backCanvas = document.createElement('canvas')
            backCanvas.width = CANVAS_BASE_WIDTH
            backCanvas.height = CANVAS_BASE_HEIGHT
            let backCtx = backCanvas.getContext('2d')
            backCanvasMap.set(artWorkId, {
                canvas: backCanvas,
                ctx: backCtx
            })

            // draw in the cache
            clear(CANVAS_BASE_WIDTH, CANVAS_BASE_HEIGHT, backCtx)
            drawArtWorkInternal(state, artWorkId, CANVAS_BASE_WIDTH, CANVAS_BASE_HEIGHT, backCtx, disablePaintCache)

            // draw from cache
            ctx.drawImage(backCanvas, 0, 0, CANVAS_BASE_WIDTH, CANVAS_BASE_HEIGHT, 0, 0, width, height)
        }
    }
    else {
        drawArtWorkInternal(state, artWorkId, width, height, ctx, disablePaintCache)
    }
}

function drawArtWorkInternal(state: Model.ProgramState, artWorkId: string, width: number, height: number, ctx: CanvasRenderingContext2D, disablePaintCache: boolean) {
    const artWork = state.artWorks[artWorkId]
    if (!artWork || !artWork.grid)
        return

    const CW = width / artWork.size.width
    const CH = height / artWork.size.height

    if (CW < 1 || CH < 1) {
        return
    }

    Object.entries(artWork.grid).forEach(([cellId, workItemId]) => {
        if (!workItemId)
            return

        let i = parseInt(cellId)
        let j = Math.floor(i / artWork.size.width)
        i %= artWork.size.width

        ctx.save()
        ctx.translate(i * CW, j * CH)
        drawWorkItemInternal(state, workItemId, CW, CH, ctx, disablePaintCache)
        ctx.restore()
    })

    if (!artWork.validated) {
        ctx.lineWidth = CW / 7
        ctx.strokeStyle = 'rgba(235,201,67,.8)'
        ctx.strokeRect(0, 0, width, height)

        ctx.fillStyle = 'rgba(255,221,87,.1)'
        ctx.fillRect(0, 0, width, height)
    }
}

function drawPixel(color: string, width: number, height: number, ctx: CanvasRenderingContext2D) {
    const MARGIN = width / 15

    ctx.fillStyle = color
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

function drawEmoji(text: string, width: number, height: number, ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = 'black'
    ctx.font = `${Math.min(width, height) * .64}px Verdana`

    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, width / 2, 1.1 * height / 2)
}