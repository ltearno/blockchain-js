import { Component, OnInit, ViewChild, AfterViewInit, Input, Output, EventEmitter, ChangeDetectorRef, OnDestroy } from '@angular/core'
import * as Paint from './paint'
import { State } from './state'

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
        if (this._artWorkId && this._artWorkId.startsWith('artwork-'))
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
    disablePaintCache: boolean = false

    @Input()
    set filterAuthor(value: string) {
        this._filterAuthor = value
        this.paint()
    }

    private _filterAuthor: string = null

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
        canvas.width = this.disablePaintCache ? 1000 : 100
        canvas.height = this.disablePaintCache ? 1000 : 100
        this.context = canvas.getContext("2d")

        this.paint()
    }

    private paint() {
        this._artWorkId && this.context && Paint.drawWorkItem(
            this._artWorkId,
            this.disablePaintCache ? 1000 : 100,
            this.disablePaintCache ? 1000 : 100,
            this.context,
            {
                cacheSize: this.disablePaintCache ? 1000 : null,
                filterAuthor: this._filterAuthor
            })
    }
}