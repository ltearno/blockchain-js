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
        this.updateFromContract()
        if (!this.changeDetectorRef['destroyed'])
            this.changeDetectorRef.detectChanges()
        this.paint()
    }

    showTabs = false

    @Input()
    artWorkId: string = null

    @Output()
    validate = new EventEmitter<void>()

    @Output()
    cancel = new EventEmitter<void>()

    setView(index) {
        if (index == 0) {
            this.viewInventory = true
            this.viewCommunity = false
        }
        else {
            this.viewInventory = false
            this.viewCommunity = true
        }
    }

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

        let notValidatedArtworkIds = {}
        Object.values(this.artWork.grid)
            .filter(id => id.startsWith('artwork-'))
            .filter(id => !this.state.programState.artWorks[id.substr('artwork-'.length)].validated)
            .forEach(id => notValidatedArtworkIds[id] = true)
        this.notValidatedWorkItemIds = Object.keys(notValidatedArtworkIds)

        let inv = this.state.programState.accounts[this.state.user.id].inventory
        this.inventory = Object.keys(inv)
            .sort()
            .map(itemId => ({ id: itemId, count: inv[itemId] }))
            .filter(item => item.count > 0)

        this.inventoryNbItems = 0
        this.inventory.forEach(item => this.inventoryNbItems += item.count)
        this._limitedInventory = null

        this.othersInventory = Object.keys(this.state.programState.artWorks).filter(artWorkId => artWorkId != this.artWorkId).sort((id1, id2) => {
            return this.state.programState.artWorks[id1].serialNumber > this.state.programState.artWorks[id2].serialNumber ? -1 : 1
        }).map(artWorkId => `artwork-${artWorkId}`)
        this._limitedOthersInventory = null

        if (!this.showTabs && (this.inventory.length > this.limitInventory || this.othersInventory.length > this.limitArtWorks)) {
            this.showTabs = true
            this.viewInventory = true
            this.viewCommunity = false
        }

        this.canValidate = Model.canValidateArtWork(this.state.programState, this.artWorkId)
    }

    @ViewChild("canvas")
    canvas

    canvasElement: HTMLCanvasElement

    mouseOver: {
        x: number
        y: number
    } = null

    titleOnly = false

    selectedInInventory = null
    selectedInOthersInventory = null

    inventoryNbItems = 0

    inventory = []
    othersInventory = []

    limitArtWorks = 20
    limitInventory = 20

    _limitedInventory = []

    get limitedInventory() {
        if (!this._limitedInventory || (this._limitedInventory.length < this.limitInventory && this.inventory.length > this._limitedInventory.length)) {
            this._limitedInventory = this.inventory.concat([]).slice(0, this.limitInventory)
        }

        return this._limitedInventory
    }

    _limitedOthersInventory = []

    get limitedOthersInventory() {
        if (!this._limitedOthersInventory || (this._limitedOthersInventory.length < this.limitArtWorks && this.othersInventory.length > this._limitedOthersInventory.length)) {
            this._limitedOthersInventory = this.othersInventory.concat([]).slice(0, this.limitArtWorks)
        }

        return this._limitedOthersInventory
    }

    canValidate = false
    notValidatedWorkItemIds = []

    viewInventory = true
    viewCommunity = true

    private context: CanvasRenderingContext2D
    artWork: Model.ArtWork = null

    plusArtWorks() {
        this.limitArtWorks *= 2
    }

    plusInventory() {
        this.limitInventory *= 2
    }

    ngAfterViewInit() {
        let canvas = this.canvas.nativeElement
        canvas.width = CANVAS_BASE_WIDTH
        canvas.height = CANVAS_BASE_HEIGHT
        this.canvasElement = canvas
        this.context = canvas.getContext("2d")

        this.paint()
    }

    pseudoOrId(id: string) {
        return (this.state.identities[id] && this.state.identities[id].pseudo) || id
    }

    sendMessage(artWorkId: string, textInput: HTMLInputElement) {
        this.state.suppyChain.sendMessageOnArtWork(this.state.user.id, artWorkId, textInput.value)
        textInput.value = ''
    }

    private pointToCoordinates(x: number, y: number) {
        let rect = this.canvasElement.getBoundingClientRect()

        return {
            x: Math.floor(((x - rect.left) / (rect.right - rect.left)) * this.artWork.size.width),
            y: Math.floor(((y - rect.top) / (rect.bottom - rect.top)) * this.artWork.size.height)
        }
    }

    async validateArtWork(title: string) {
        if (!title || !title.trim().length) {
            this.titleOnly = true
        }
        else {
            if (this.artWork && this.artWork.id && this.artWork.title != title)
                await this.updateArtWorkTitle(title)

            this.validate.emit()
        }
    }

    async updateArtWorkTitle(title) {
        if (title && title.length > 100)
            title = title.substr(0, 100)

        await this.state.suppyChain.updateArtWorkTitle(this.artWork.id, title)
    }

    async changeArtWorkSize(width, height) {
        this.state.suppyChain.updateArtWorkSize(this.artWork.id, width, height)
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
        let coordIndex = `${coords.x + this.artWork.size.width * coords.y}`

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

        Paint.clearSync(CANVAS_BASE_WIDTH, CANVAS_BASE_HEIGHT, this.context)
        Paint.drawArtWorkSync(this.artWork.id, CANVAS_BASE_WIDTH, CANVAS_BASE_HEIGHT, this.context)
        if (this.mouseOver)
            Paint.drawCellSync(this.artWork, this.mouseOver.x, this.mouseOver.y, CANVAS_BASE_WIDTH, CANVAS_BASE_HEIGHT, this.context)
    }
}
