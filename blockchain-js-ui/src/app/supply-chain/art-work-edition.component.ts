import { Component, OnInit, ViewChild, AfterViewInit, Input, Output, EventEmitter } from '@angular/core'
import * as Model from './model'
import * as Paint from './paint'
import { State } from './state'

@Component({
    selector: 'art-work-edition',
    templateUrl: './art-work-edition.component.html',
    styles: [`
    .selected {
        border: 1px solid black;
    }
    `]
})
export class ArtWorkEditionComponent implements AfterViewInit {
    @ViewChild("canvas")
    canvas

    canvasElement: HTMLCanvasElement

    mouseOver: {
        x: number
        y: number
    } = null

    selectedInInventory = null
    selectedInOthersInventory = null

    get inventory() {
        let inv = this.state.programState.accounts[this.state.userId].inventory
        return Object.keys(inv).map(itemId => ({ id: itemId, count: inv[itemId] }))
    }

    get othersInventory() {
        let res = {}
        Object.keys(this.state.programState.accounts).filter(userId => userId != this.state.userId).forEach(userId => {
            let inv = this.state.programState.accounts[this.state.userId].inventory
            Object.keys(inv).forEach(itemId => {
                if (!res[itemId])
                    res[itemId] = 0
                res[itemId] += inv[itemId]
            })
        })

        return Object.keys(res).map(itemId => ({ id: itemId, count: res[itemId] }))
    }

    @Input()
    set artWork(artWork) {
        this._artWork = artWork

        if (!this._artWork.grid) {
            this._artWork.grid = new Array(this._artWork.size.width * this._artWork.size.height)
            this._artWork.grid[2 * 2] = { ownerId: null, accepted: false, workItemId: "pixel-black" }
            this._artWork.grid[3 * 2] = { ownerId: null, accepted: false, workItemId: "emoji-😁" }
        }


        this.paint
    }

    @Output()
    validate = new EventEmitter<void>()

    @Output()
    cancel = new EventEmitter<void>()

    get artWork() {
        return this._artWork
    }

    private context: CanvasRenderingContext2D
    private _artWork: Model.ArtWork = null

    constructor(
        public state: State
    ) {
    }

    ngAfterViewInit() {
        let canvas = this.canvas.nativeElement
        this.canvasElement = canvas
        this.context = canvas.getContext("2d")

        this.paint()
    }

    private pointToCoordinates(x: number, y: number) {
        let rect = this.canvasElement.getBoundingClientRect()

        return {
            x: Math.floor(((x - rect.left) / (rect.right - rect.left)) * this._artWork.size.width),
            y: Math.floor(((y - rect.top) / (rect.bottom - rect.top)) * this._artWork.size.height)
        }
    }

    mouseMove(event: MouseEvent) {
        this.mouseOver = this.pointToCoordinates(event.clientX, event.clientY)

        this.paint()
    }

    mouseOut() {
        this.mouseOver = null

        this.paint()
    }

    mouseClick(event: MouseEvent) {
        let itemId = this.selectedInInventory || this.selectedInOthersInventory
        if (!itemId)
            return

        let coords = this.pointToCoordinates(event.clientX, event.clientY)

        this._artWork.grid[coords.x + this._artWork.size.width * coords.y] = {
            ownerId: this.state.userId,
            workItemId: itemId
        }

        this.paint()
    }

    selectInventory(itemId) {
        this.selectedInOthersInventory = null
        this.selectedInInventory = itemId
    }

    selectOthersInventory(itemId) {
        this.selectedInInventory = null
        this.selectedInOthersInventory = itemId
    }

    private paint() {
        Paint.clear(400, 400, this.context)
        if (this.mouseOver)
            Paint.drawCell(this._artWork, this.mouseOver.x, this.mouseOver.y, 400, 400, this.context)
        Paint.drawArtWork(this.state.programState, this._artWork, 400, 400, this.context)
    }
}
