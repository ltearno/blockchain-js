import * as Model from './model'
import { CANVAS_BASE_WIDTH, CANVAS_BASE_HEIGHT } from '../constants'

const USE_BACK_CACHE = true
const EMPTY_STATE = {
    accounts: {},
    artWorks: {},
    redistributableItems: []
}

interface BackBuffer {
    canvas: HTMLCanvasElement
    ctx: CanvasRenderingContext2D
}

let backCanvasMap = new Map<any, Map<string, BackBuffer>>()

let supplyChainState: Model.ProgramState = EMPTY_STATE

let orders = []
let waitBeforeClear = false
let requested = false

const onFrame = () => {
    requested = false

    let poolSize = 20
    while (orders.length) {
        if (!waitBeforeClear && orders[0].f == clearSync && (poolSize-- <= 0)) {
            waitBeforeClear = true
            break
        }
        waitBeforeClear = false

        let { f, args } = orders.shift()
        f.call(null, ...args)
    }

    if (orders.length && !requested) {
        requested = true
        requestAnimationFrame(onFrame)
    }
}

const addFrame = (obj) => {
    orders.push(obj)

    if (!requested) {
        requested = true
        requestAnimationFrame(onFrame)
    }
}

export function setSmartProgram(smartContract) {
    smartContract.addChangeListener(() => {
        supplyChainState = smartContract.getContractState("supply-chain-v1")
        resetCache()
    })
}

export function clear(width: number, height: number, ctx: CanvasRenderingContext2D) {
    addFrame({
        f: clearSync,
        args: [
            width,
            height,
            ctx
        ]
    })
}

export function drawWorkItem(id: string, width: number, height: number, ctx: CanvasRenderingContext2D, options: Options = null) {
    addFrame({
        f: drawWorkItemSync,
        args: [
            id,
            width,
            height,
            ctx,
            options
        ]
    })
}

export function drawArtWork(artWorkId: string, width: number, height: number, ctx: CanvasRenderingContext2D, options: Options = null) {
    addFrame({
        f: drawArtWorkSync,
        args: [
            artWorkId,
            width,
            height,
            ctx,
            options
        ]
    })
}

export function drawCellSync(artWork: Model.ArtWork, i: number, j: number, width: number, height: number, ctx: CanvasRenderingContext2D) {
    const CW = width / artWork.size.width
    const CH = height / artWork.size.height
    const MARGIN = CW / 20

    ctx.fillStyle = 'rgba(0,0,0,.2)'
    ctx.fillRect(i * CW - MARGIN, j * CH - MARGIN, CW + 2 * MARGIN, CH + 2 * MARGIN)
}

export function clearSync(width: number, height: number, ctx: CanvasRenderingContext2D) {
    if (!ctx)
        return

    ctx.clearRect(0, 0, width, height)
}

export function drawWorkItemSync(id: string, width: number, height: number, ctx: CanvasRenderingContext2D, options: Options = null) {
    clearSync(width, height, ctx)
    drawWorkItemInternal(id, width, height, ctx, null, options)
}

export function drawArtWorkSync(artWorkId: string, width: number, height: number, ctx: CanvasRenderingContext2D, options: Options = null) {
    if (USE_BACK_CACHE && !(options && options.disablePaintCache)) {
        let cacheSize
        if (options && options.cacheSize)
            cacheSize = options.cacheSize
        else
            cacheSize = CANVAS_BASE_WIDTH

        let cacheKey = cacheSize
        if (options && options.filterAuthor)
            cacheKey = options.filterAuthor + '-' + cacheKey

        let cache = backCanvasMap.get(cacheKey)
        if (!cache) {
            cache = new Map()
            backCanvasMap.set(cacheKey, cache)
        }

        if (cache.has(artWorkId)) {
            ctx.drawImage(cache.get(artWorkId).canvas, 0, 0, cacheSize, cacheSize, 0, 0, width, height)
        }
        else {
            // create back canvas
            let backCanvas = document.createElement('canvas')
            backCanvas.width = cacheSize
            backCanvas.height = cacheSize
            let backCtx = backCanvas.getContext('2d')
            cache.set(artWorkId, {
                canvas: backCanvas,
                ctx: backCtx
            })

            // draw in the cache
            //clearSync(cacheSize, cacheSize, backCtx)
            drawArtWorkInternal(artWorkId, cacheSize, cacheSize, backCtx, options)

            // draw from cache
            ctx.drawImage(backCanvas, 0, 0, cacheSize, cacheSize, 0, 0, width, height)
        }
    }
    else {
        drawArtWorkInternal(artWorkId, width, height, ctx, options)
    }
}

export interface Options {
    disablePaintCache?: boolean
    cacheSize?: number
    filterAuthor?: string
}

function resetCache() {
    backCanvasMap.clear()
}

function drawWorkItemInternal(id: string, width: number, height: number, ctx: CanvasRenderingContext2D, currentAuthor: string, options: Options) {
    if (id.startsWith('pixel-')) {
        drawPixel(id.substr('pixel-'.length), width, height, ctx, options && options.filterAuthor && options.filterAuthor != currentAuthor)
    }
    else if (id.startsWith('emoji-')) {
        drawEmoji(id.substr('emoji-'.length), width, height, ctx, options && options.filterAuthor && options.filterAuthor != currentAuthor)
    }
    else if (id.startsWith('artwork-')) {
        drawArtWorkSync(id.substr('artwork-'.length), width, height, ctx, options)
    }
}

function drawArtWorkInternal(artWorkId: string, width: number, height: number, ctx: CanvasRenderingContext2D, options: Options) {
    const artWork = supplyChainState && supplyChainState.artWorks && supplyChainState.artWorks[artWorkId]
    if (!artWork || !artWork.grid)
        return

    const CW = width / artWork.size.width
    const CH = height / artWork.size.height

    if (CW < 1 || CH < 1) {
        return
    }

    if (options && options.filterAuthor && options.filterAuthor != artWork.author) {
        ctx.fillStyle = 'rgba(0,0,0,.05)'
        ctx.strokeStyle = 'rgba(0,0,0,.05)'
        ctx.lineJoin = "round"
        ctx.strokeRect(0, 0, width, height)
    }

    Object.entries(artWork.grid).forEach(([cellId, workItemId]) => {
        if (!workItemId)
            return

        let i = parseInt(cellId)
        let j = Math.floor(i / artWork.size.width)
        i %= artWork.size.width

        ctx.save()
        ctx.translate(i * CW, j * CH)
        drawWorkItemInternal(workItemId, CW, CH, ctx, artWork.author, options)
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

function drawPixel(color: string, width: number, height: number, ctx: CanvasRenderingContext2D, fade: boolean) {
    const MARGIN = width / 15

    if (fade) {
        ctx.fillStyle = 'rgba(0,0,0,.05)'
        ctx.strokeStyle = 'rgba(0,0,0,.05)'
    }
    else {
        ctx.fillStyle = color
        ctx.strokeStyle = color
    }
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

function drawEmoji(text: string, width: number, height: number, ctx: CanvasRenderingContext2D, fade: boolean) {
    if (fade)
        ctx.fillStyle = 'rgba(0,0,0,.05)'
    else
        ctx.fillStyle = 'black'
    ctx.font = `${Math.min(width, height) * .64}px Verdana`

    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, width / 2, 1.1 * height / 2)
}