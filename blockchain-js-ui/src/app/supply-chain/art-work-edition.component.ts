import { Component, OnInit, ViewChild, AfterViewInit, Input, Output, EventEmitter } from '@angular/core'
import * as Model from './model'
import * as Paint from './paint'
import { State } from './state'

@Component({
    selector: 'art-work-edition',
    templateUrl: './art-work-edition.component.html'
})
export class ArtWorkEditionComponent implements AfterViewInit {
    @ViewChild("canvas")
    canvas

    canvasElement: HTMLCanvasElement

    mouseOver: {
        x: number
        y: number
    } = null

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

    mouseMove(event: MouseEvent) {
        let rect = this.canvasElement.getBoundingClientRect()
        let x = (event.clientX - rect.left) / (rect.right - rect.left)
        let y = (event.clientY - rect.top) / (rect.bottom - rect.top)

        this.mouseOver = {
            x: Math.floor(x * this._artWork.size.width),
            y: Math.floor(y * this._artWork.size.height)
        }

        this.paint()
    }

    private paint() {
        Paint.clear(400, 400, this.context)
        if (this.mouseOver)
            Paint.drawCell(this._artWork, this.mouseOver.x, this.mouseOver.y, 400, 400, this.context)
        Paint.drawArtWork(this.state.programState, this._artWork, 400, 400, this.context)
    }
}
