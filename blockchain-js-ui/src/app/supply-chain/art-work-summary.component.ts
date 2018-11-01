import { Component, OnInit, ViewChild, AfterViewInit, Input, Output, EventEmitter, ChangeDetectorRef, OnDestroy } from '@angular/core'
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

    .card-image {
        box-shadow: 0px 8px 15px 4px rgba(169, 169, 169, 0.13);
    }
    `]
})
export class ArtWorkSummaryComponent implements AfterViewInit, OnInit, OnDestroy {
    @ViewChild("canvas")
    canvas

    private context: CanvasRenderingContext2D
    private _artWork: Model.ArtWork = null

    private smartContractChangeListener = () => {
        if (!this.changeDetectionRef['destroyed']) {
            this.changeDetectionRef.detectChanges()
        }

        this.paint()
    }

    constructor(
        private changeDetectionRef: ChangeDetectorRef,
        public state: State
    ) {
        this.state.smartContract.addChangeListener(this.smartContractChangeListener)
    }

    ngOnInit() {
    }

    ngOnDestroy() {
        this.state.smartContract.removeChangeListener(this.smartContractChangeListener)
    }

    @Input()
    set artWork(artWork) {
        this._artWork = artWork

        this.paint()
    }

    get artWork() {
        return this._artWork
    }

    @Output()
    select = new EventEmitter<Model.ArtWork>()

    @Output()
    edit = new EventEmitter<Model.ArtWork>()

    ngAfterViewInit() {
        let canvas = this.canvas.nativeElement
        canvas.width = CANVAS_BASE_WIDTH
        canvas.height = CANVAS_BASE_HEIGHT
        this.context = canvas.getContext("2d")

        this.paint()
        this.changeDetectionRef.detach()
    }

    private paint() {
        Paint.clear(CANVAS_BASE_WIDTH, CANVAS_BASE_HEIGHT, this.context)
        this._artWork && this.context && Paint.drawArtWork(this.state.programState, this._artWork, CANVAS_BASE_WIDTH, CANVAS_BASE_HEIGHT, this.context)
    }

    sendMessage(artWorkId: string, textInput: HTMLInputElement) {
        this.state.suppyChain.sendMessageOnArtWork(this.state.user.pseudo, artWorkId, textInput.value)
        textInput.value = ''
    }
}