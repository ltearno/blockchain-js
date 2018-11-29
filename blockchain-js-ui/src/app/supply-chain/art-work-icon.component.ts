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
    private _filterAuthor: string = null
    private _disablePaintCache: boolean = false

    constructor(
        public state: State
    ) {
    }

    ngOnInit() {
    }

    ngOnDestroy() {
        Paint.removeArtworkFromPool(this.context)
    }

    @Input()
    set disablePaintCache(value: boolean) {
        this._disablePaintCache = value
        this.updatePaintPool()
    }

    @Input()
    set filterAuthor(value: string) {
        this._filterAuthor = value
        this.updatePaintPool()
    }

    @Input()
    set artWorkId(artWorkId) {
        this._artWorkId = artWorkId
        this.updatePaintPool()
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

        this.updatePaintPool()
    }

    private updatePaintPool() {
        if (!this._artWorkId || !this.context)
            return

        Paint.updatePool(this.context, this._artWorkId,
            this.disablePaintCache ? 1000 : 100,
            this.disablePaintCache ? 1000 : 100,
            {
                cacheSize: this.disablePaintCache ? 1000 : null,
                disablePaintCache: this._disablePaintCache,
                filterAuthor: this._filterAuthor
            })
    }
}