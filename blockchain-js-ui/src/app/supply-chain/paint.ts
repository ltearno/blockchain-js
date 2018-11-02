import * as Model from './model'
import { CANVAS_BASE_WIDTH, CANVAS_BASE_HEIGHT } from '../constants'

const USE_BACK_CACHE = true

interface BackBuffer {
    canvas: HTMLCanvasElement
    ctx: CanvasRenderingContext2D
}

let backCanvasMap = new Map<string, BackBuffer>()

//window['backCanvas'] = () => document.body.appendChild(backCanvas)

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

    ctx.fillStyle = 'white'
    ctx.fillRect(0, 0, width, height)
}

function resetCache() {
    backCanvasMap.clear()
}

let paintBuffer = []

const DEFERRED_PAIN = false

export function drawWorkItem(state: Model.ProgramState, id: string, width: number, height: number, ctx: CanvasRenderingContext2D) {
    if (DEFERRED_PAIN) {
        paintBuffer = paintBuffer.filter(item => item.ctx != ctx)
        paintBuffer.push({ state, id, width, height, ctx })
        requestAnimationFrame(scheduledPaint)
    }
    else {
        drawWorkItemInternal(state, id, width, height, ctx)
    }
}

function drawWorkItemInternal(state: Model.ProgramState, id: string, width: number, height: number, ctx: CanvasRenderingContext2D) {
    if (id.startsWith('pixel-')) {
        drawPixel(id.substr('pixel-'.length), width, height, ctx)
    }
    else if (id.startsWith('emoji-')) {
        drawEmoji(id.substr('emoji-'.length), width, height, ctx)
    }
    else if (id.startsWith('artwork-')) {
        drawArtWork(state, id.substr('artwork-'.length), width, height, ctx)
    }
}

export function drawArtWork(state: Model.ProgramState, artWorkId: string, width: number, height: number, ctx: CanvasRenderingContext2D) {
    if (USE_BACK_CACHE) {
        if (backCanvasMap.has(artWorkId)) {
            //console.log(`cache draw ${artWorkId}`)
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
            console.log(`draw on backCanvas ${artWorkId}`)
            clear(CANVAS_BASE_WIDTH, CANVAS_BASE_HEIGHT, backCtx)
            drawArtWorkInternal(state, artWorkId, CANVAS_BASE_WIDTH, CANVAS_BASE_HEIGHT, backCtx)

            // draw from cache
            console.log(`draw on canvas from back ${artWorkId} w:${width} h:${height}`)
            ctx.drawImage(backCanvas, 0, 0, CANVAS_BASE_WIDTH, CANVAS_BASE_HEIGHT, 0, 0, width, height)
        }
    }
    else {
        drawArtWorkInternal(state, artWorkId, width, height, ctx)
    }
}

function drawArtWorkInternal(state: Model.ProgramState, artWorkId: string, width: number, height: number, ctx: CanvasRenderingContext2D) {
    const artWork = state.artWorks[artWorkId]
    if (!artWork || !artWork.grid)
        return

    const CW = width / artWork.size.width
    const CH = height / artWork.size.height

    if (CW < 1 || CH < 1) {
        console.log(`too fine grained ${CW}x${CH} !`)
        return
    }

    for (let i = 0; i < artWork.size.width; i++) {
        for (let j = 0; j < artWork.size.height; j++) {
            let value = artWork.grid[j * artWork.size.width + i]

            if (value) {
                ctx.save()
                ctx.translate(i * CW, j * CH)
                drawWorkItemInternal(state, value.workItemId, CW, CH, ctx)
                if (!value.ownerId) {
                    /*ctx.beginPath()
                    ctx.strokeStyle = 'rgba(0,0,0,.4)'
                    ctx.lineWidth = CW / 5
                    ctx.moveTo(0, 0)
                    ctx.lineTo(CW - 1, CH - 1)
                    ctx.moveTo(CW - 1, 0)
                    ctx.lineTo(0, CH - 1)
                    ctx.stroke()*/

                    ctx.fillStyle = 'rgba(0,0,0,.2)'
                    ctx.fillRect(0, 0, CW, CH)
                }
                ctx.restore()
            }
        }
    }
}

function scheduledPaint() {
    if (paintBuffer.length == 0)
        return

    let { state, id, width, height, ctx } = paintBuffer.shift()

    drawWorkItemInternal(state, id, width, height, ctx)

    requestAnimationFrame(scheduledPaint)
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