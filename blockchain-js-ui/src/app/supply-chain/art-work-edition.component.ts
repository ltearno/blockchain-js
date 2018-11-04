import { Component, OnInit, ViewChild, AfterViewInit, Input, Output, EventEmitter, OnDestroy, ChangeDetectorRef } from '@angular/core'
import * as Model from './model'
import * as Paint from './paint'
import { State } from './state'
import { CANVAS_BASE_WIDTH, CANVAS_BASE_HEIGHT } from '../constants';

@Component({
    selector: 'art-work-edition',
    templateUrl: './art-work-edition.component.html',
    styles: [`
    .selected {
        border: 1px solid black;
    }
    `]
})
export class ArtWorkEditionComponent implements AfterViewInit, OnDestroy {
    private smartContractChangeListener = () => {
        console.log(`edititon receives change listener`)
        this.updateFromContract()
        this.changeDetectorRef.detectChanges()
        this.paint()
    }

    @Input()
    artWorkId: string = null

    @Output()
    validate = new EventEmitter<void>()

    @Output()
    cancel = new EventEmitter<void>()

    constructor(public state: State, private changeDetectorRef: ChangeDetectorRef) {
    }

    ngOnInit() {
        this.state.smartContract.addChangeListener(this.smartContractChangeListener)
        this.updateFromContract()
    }

    ngOnDestroy() {
        this.state.smartContract.removeChangeListener(this.smartContractChangeListener)
    }

    private updateFromContract() {
        this.artWork = this.state.programState.artWorks[this.artWorkId]

        let inv = this.state.programState.accounts[this.state.user.pseudo].inventory
        this.inventory = Object.keys(inv).sort().map(itemId => ({ id: itemId, count: inv[itemId] })).filter(item => item.count > 0)

        this.othersInventory = Object.keys(this.state.programState.artWorks).sort()
    }

    @ViewChild("canvas")
    canvas

    canvasElement: HTMLCanvasElement

    mouseOver: {
        x: number
        y: number
    } = null

    selectedInInventory = null
    selectedInOthersInventory = null

    inventory = []
    othersInventory = []

    private context: CanvasRenderingContext2D
    artWork: Model.ArtWork = null

    ngAfterViewInit() {
        let canvas = this.canvas.nativeElement
        canvas.width = CANVAS_BASE_WIDTH
        canvas.height = CANVAS_BASE_HEIGHT
        this.canvasElement = canvas
        this.context = canvas.getContext("2d")

        this.paint()
    }

    private pointToCoordinates(x: number, y: number) {
        let rect = this.canvasElement.getBoundingClientRect()

        return {
            x: Math.floor(((x - rect.left) / (rect.right - rect.left)) * this.artWork.size.width),
            y: Math.floor(((y - rect.top) / (rect.bottom - rect.top)) * this.artWork.size.height)
        }
    }

    async updateArtWorkTitle(title) {
        console.log(`update title ${title}`)
        await this.state.suppyChain.updateArtWorkTitle(this.artWork.id, title)
    }

    async changeArtWorkSize(width, height) {
        await this.state.suppyChain.updateArtWorkSize(this.artWork.id, width, height)

        this.paint()
    }

    mouseMove(event: MouseEvent) {
        this.mouseOver = this.pointToCoordinates(event.clientX, event.clientY)

        this.paint()
    }

    mouseOut() {
        this.mouseOver = null

        this.paint()
    }

    async mouseClick(event: MouseEvent) {
        let coords = this.pointToCoordinates(event.clientX, event.clientY)
        let coordIndex = coords.x + this.artWork.size.width * coords.y

        if (this.artWork.grid[coordIndex]) {
            await this.state.suppyChain.removeCellFromArtWork(this.artWork.id, coords.x, coords.y)
        }
        else {
            let itemId = this.selectedInInventory || this.selectedInOthersInventory
            if (!itemId)
                return

            await this.state.suppyChain.addItemInArtWorkFromInventory(this.artWork.id, itemId, coords.x, coords.y)
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
        if (!this.context)
            return

        Paint.clear(CANVAS_BASE_WIDTH, CANVAS_BASE_HEIGHT, this.context)
        Paint.drawArtWork(this.state.programState, this.artWork.id, CANVAS_BASE_WIDTH, CANVAS_BASE_HEIGHT, this.context)
        if (this.mouseOver)
            Paint.drawCell(this.artWork, this.mouseOver.x, this.mouseOver.y, CANVAS_BASE_WIDTH, CANVAS_BASE_HEIGHT, this.context)
    }
}
