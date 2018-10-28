import { Component, OnInit, ViewChild, AfterViewInit, Input, Output, EventEmitter, ChangeDetectorRef, OnDestroy } from '@angular/core'
import * as Model from './model'
import * as Paint from './paint'
import { State } from './state'
import { text } from '@angular/core/src/render3/instructions';

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
        if (!this.changeDetectionRef['destroyed'])
            this.changeDetectionRef.detectChanges()
    
        this.paint()
    }

    constructor(
        private changeDetectionRef: ChangeDetectorRef,
        public state: State
    ) {
        this.changeDetectionRef.detach()
        this.state.smartContract.addChangeListener(this.smartContractChangeListener)
    }

    ngOnInit() {
        this.changeDetectionRef.detectChanges()
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
        this.context = canvas.getContext("2d")

        this.paint()
    }

    private paint() {
        Paint.clear(400, 400, this.context)
        this._artWork && this.context && Paint.drawArtWork(this.state.programState, this._artWork, 400, 400, this.context)
    }

    sendMessage(artWorkId: string, textInput: HTMLInputElement) {
        this.state.suppyChain.sendMessageOnArtWork(this.state.user.pseudo, artWorkId, textInput.value)
        textInput.value = ''
    }
}