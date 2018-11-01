import * as Model from './model'
import { CANVAS_BASE_WIDTH, CANVAS_BASE_HEIGHT } from '../constants';

let backCanvasMapMaxSize = 50
let backCanvas = document.createElement('canvas')
backCanvas.width = CANVAS_BASE_WIDTH * backCanvasMapMaxSize
backCanvas.height = CANVAS_BASE_HEIGHT
let backCanvasContext = backCanvas.getContext('2d')
let backCanvasMap = {}
let backCanvasMapSize = 0

window['backCanvas'] = () => document.body.appendChild(backCanvas)

export function setSmartProgram(smartContract) {
    smartContract.addChangeListener(() => resetCache('-'))
}

function resetCache(commit: string) {
    console.log(`=== PAINT RESET CACHE FOR COMMIT ${commit} ===`)
    backCanvasMap = {}
    backCanvasMapSize = 0
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

export function drawArtWork(state: Model.ProgramState, artWork: Model.ArtWork, width: number, height: number, ctx: CanvasRenderingContext2D) {
    drawArtWorkInternal(state, artWork, width, height, ctx)
}

export function drawArtWorkInternal(state: Model.ProgramState, artWork: Model.ArtWork, width: number, height: number, ctx: CanvasRenderingContext2D) {
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
                drawWorkItemInternal(state, value.workItemId, CW, CH, ctx)
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

let paintBuffer = []

export function drawWorkItem(state: Model.ProgramState, id: string, width: number, height: number, ctx: CanvasRenderingContext2D) {
    //drawWorkItemInternal(state, id, width, height, ctx)

    paintBuffer = paintBuffer.filter(item => item.ctx != ctx)
    paintBuffer.push({ state, id, width, height, ctx })
    requestAnimationFrame(scheduledPaint)
}

function scheduledPaint() {
    if (paintBuffer.length == 0)
        return

    let { state, id, width, height, ctx } = paintBuffer.shift()

    drawWorkItemInternal(state, id, width, height, ctx)

    requestAnimationFrame(scheduledPaint)
}

function drawWorkItemInternal(state: Model.ProgramState, id: string, width: number, height: number, ctx: CanvasRenderingContext2D) {
    if (id.startsWith('pixel-')) {
        drawPixel(id.substr('pixel-'.length), width, height, ctx)
    }
    else if (id.startsWith('emoji-')) {
        drawEmoji(id.substr('emoji-'.length), width, height, ctx)
    }
    else if (id.startsWith('artwork-')) {
        if (backCanvasMap[id] !== undefined) {
            ctx.drawImage(backCanvas, backCanvasMap[id] * CANVAS_BASE_WIDTH, 0, CANVAS_BASE_WIDTH, CANVAS_BASE_HEIGHT, 0, 0, width, height)
        }
        else if (backCanvasMapSize < backCanvasMapMaxSize) {
            // reserve a place in the cache
            let cacheCell = backCanvasMapSize++
            backCanvasMap[id] = cacheCell

            // draw in the cache
            backCanvasContext.save()
            backCanvasContext.translate(cacheCell * CANVAS_BASE_WIDTH, 0)
            drawArtWorkInternal(state, state.artWorks[id.substr('artwork-'.length)], CANVAS_BASE_WIDTH, CANVAS_BASE_HEIGHT, backCanvasContext)
            backCanvasContext.fillStyle = 'rgb(.2,.2,.2)'
            backCanvasContext.fillRect(0, 0, CANVAS_BASE_WIDTH, CANVAS_BASE_HEIGHT)
            backCanvasContext.strokeStyle = "10px solid black"
            backCanvasContext.strokeRect(0, 0, CANVAS_BASE_WIDTH, CANVAS_BASE_HEIGHT)
            backCanvasContext.restore()

            // draw from cache
            ctx.drawImage(backCanvas, cacheCell * CANVAS_BASE_WIDTH, 0, CANVAS_BASE_WIDTH, CANVAS_BASE_HEIGHT, 0, 0, width, height)
        }
        else {
            drawArtWorkInternal(state, state.artWorks[id.substr('artwork-'.length)], width, height, ctx)
        }
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