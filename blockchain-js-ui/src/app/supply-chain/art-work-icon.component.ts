import { Component, OnInit, ViewChild, AfterViewInit, Input, Output, EventEmitter, ChangeDetectorRef, OnDestroy } from '@angular/core'
import * as Model from './model'
import * as Paint from './paint'
import { State } from './state'
import { CANVAS_BASE_WIDTH, CANVAS_BASE_HEIGHT } from '../constants';

@Component({
    selector: 'art-work-icon',
    templateUrl: './art-work-icon.component.html'
})
export class ArtWorkIconComponent implements AfterViewInit, OnInit, OnDestroy {
    @ViewChild("canvas")
    canvas

    private context: CanvasRenderingContext2D
    private _artWorkId: string = null

    private smartContractChangeListener = () => {
        this.paint()
    }

    constructor(
        private changeDetectionRef: ChangeDetectorRef,
        public state: State
    ) {
    }

    ngOnInit() {
        this.changeDetectionRef.detach()
        this.state.smartContract.addChangeListener(this.smartContractChangeListener)
    }

    ngOnDestroy() {
        this.state.smartContract.removeChangeListener(this.smartContractChangeListener)
    }

    @Input()
    set artWorkId(artWorkId) {
        this._artWorkId = artWorkId

        this.paint()
    }

    get artWorkId() {
        return this._artWorkId
    }

    @Output()
    selected = new EventEmitter<null>()

    select() {
        this.selected.emit()
    }

    ngAfterViewInit() {
        let canvas = this.canvas.nativeElement
        canvas.width = 100
        canvas.height = 100
        this.context = canvas.getContext("2d")

        this.paint()
    }

    private paint() {
        this._artWorkId && this.context && Paint.drawWorkItem(this.state.programState, this._artWorkId, 100, 100, this.context)
    }
}