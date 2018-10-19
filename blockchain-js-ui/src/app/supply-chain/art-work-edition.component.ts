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

        let claims = this.claimsByOthers()

        return Object.keys(inv).map(itemId => ({ id: itemId, count: inv[itemId], claimsBy: claims[itemId] }))
    }

    get othersInventory() {
        let res = {}
        Object.keys(this.state.programState.accounts).filter(userId => userId != this.state.userId).forEach(userId => {
            let inv = this.state.programState.accounts[userId].inventory
            Object.keys(inv).forEach(itemId => {
                if (!res[itemId])
                    res[itemId] = 0
                res[itemId] += inv[itemId]
            })
        })

        return Object.keys(res).map(itemId => ({ id: itemId, count: res[itemId] }))
    }

    // les choses que je possède que les autres veulent
    private claimsByOthers() {
        let claims = {}

        for (let artWorkId in this.state.programState.artWorks) {
            let artWork = this.state.programState.artWorks[artWorkId]
            if (artWork.validated || !artWork.grid)
                continue

            artWork.grid.filter(cell => cell && !cell.ownerId && this.state.programState.accounts[this.state.userId].inventory[cell.workItemId] > 0)
                .forEach(cell => {
                    if (!claims[cell.workItemId])
                        claims[cell.workItemId] = []
                    claims[cell.workItemId].push(artWork.author)
                })
        }

        return claims
    }

    @Input()
    set artWork(artWork) {
        this._artWork = artWork

        if (!this._artWork.grid) {
            this._artWork.grid = new Array(this._artWork.size.width * this._artWork.size.height)
            this._artWork.grid[2 * 2] = { ownerId: null, workItemId: "pixel-black" }
            this._artWork.grid[3 * 2] = { ownerId: null, workItemId: "emoji-😁" }
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
        let coords = this.pointToCoordinates(event.clientX, event.clientY)
        let coordIndex = coords.x + this._artWork.size.width * coords.y

        if (this._artWork.grid[coordIndex]) {
            let ownerId = this._artWork.grid[coordIndex].ownerId
            let itemId = this._artWork.grid[coordIndex].workItemId

            this._artWork.grid[coordIndex] = null

            if (ownerId) {
                if (!this.state.programState.accounts[ownerId].inventory[itemId])
                    this.state.programState.accounts[ownerId].inventory[itemId] = 0
                this.state.programState.accounts[ownerId].inventory[itemId]++
            }
        }
        else {
            let itemId = this.selectedInInventory || this.selectedInOthersInventory
            if (!itemId)
                return

            if (this.selectedInInventory) {
                if (this.state.programState.accounts[this.state.userId].inventory[this.selectedInInventory] > 0) {
                    this._artWork.grid[coordIndex] = {
                        ownerId: this.state.userId,
                        workItemId: itemId
                    }

                    this.state.programState.accounts[this.state.userId].inventory[this.selectedInInventory]--
                }
            }
            else if (this.selectedInOthersInventory) {
                this._artWork.grid[coordIndex] = {
                    ownerId: null,
                    workItemId: itemId
                }
            }
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
