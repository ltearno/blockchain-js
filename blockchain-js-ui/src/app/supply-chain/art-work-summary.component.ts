import { Component, ViewChild, AfterViewInit, Input, Output, EventEmitter, OnDestroy, ChangeDetectorRef } from '@angular/core'
import * as Model from './model'
import * as Paint from './paint'
import { State } from './state'
import { CANVAS_BASE_WIDTH, CANVAS_BASE_HEIGHT } from '../constants';

@Component({
    selector: 'art-work-summary',
    templateUrl: './art-work-summary.component.html',
    styles: [`
    .artWork-card   {
        box-shadow: 0px 0px 5em 10px rgba(193, 187, 187, 0.1), 5px 7px 15px 1px rgba(10, 10, 10, 0.1);
        overflow: hidden;
        margin: .5em;
    }

    .artWork-card .card-image .artWork-icon {
        display: flex;
        justify-content: center;
    }

    .card-image {
        box-shadow: 0px 8px 15px 4px rgba(169, 169, 169, 0.13);
    }
    `]
})
export class ArtWorkSummaryComponent implements AfterViewInit, OnDestroy {
    @ViewChild("canvas")
    canvas

    private context: CanvasRenderingContext2D
    private _artWorkId: string = null

    private smartContractChangeListener = () => {
        this.updateArtWorkFromId()
        if (!this.changeDetectorRef['destroyed'])
            this.changeDetectorRef.detectChanges()
    }

    constructor(
        public state: State,
        private changeDetectorRef: ChangeDetectorRef
    ) {
        this.state.smartContract.addChangeListener(this.smartContractChangeListener)
    }

    ngOnDestroy() {
        this.state.smartContract.removeChangeListener(this.smartContractChangeListener)
        Paint.removeArtworkFromPool(this.context)
    }

    @Input()
    set artWorkId(artWorkId) {
        this._artWorkId = artWorkId
        this.updateArtWorkFromId()

        this.updatePaintPool()
    }

    private updateArtWorkFromId() {
        this.artWork = this.state.programState.artWorks[this._artWorkId]
        this.canValidate = Model.canValidateArtWork(this.state.programState, this._artWorkId)
    }

    artWork: Model.ArtWork = null
    canValidate: boolean = false

    @Output()
    select = new EventEmitter<Model.ArtWork>()

    @Output()
    edit = new EventEmitter<Model.ArtWork>()

    ngAfterViewInit() {
        let canvas = this.canvas.nativeElement
        canvas.width = CANVAS_BASE_WIDTH
        canvas.height = CANVAS_BASE_HEIGHT
        this.context = canvas.getContext("2d")

        this.updatePaintPool()
    }

    isArtWorkEmpty() {
        if (!this.artWork)
            return true
        return (!this.artWork || !this.artWork.grid || Object.keys(this.artWork.grid).length == 0) && (this.state.user && this.state.user.id != this.artWork.author)
    }

    private updatePaintPool() {
        Paint.updatePool(this.context, 'artwork-' + this._artWorkId, CANVAS_BASE_WIDTH, CANVAS_BASE_HEIGHT)
    }

    validate() {
        this.state.suppyChain.validateArtWork(this._artWorkId)
    }
}