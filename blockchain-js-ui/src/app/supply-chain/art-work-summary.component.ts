import { Component, OnInit, ViewChild, AfterViewInit, Input, Output, EventEmitter } from '@angular/core'
import * as Model from './model'
import * as Paint from './paint'
import { State } from './state'
import { text } from '@angular/core/src/render3/instructions';

@Component({
    selector: 'art-work-summary',
    templateUrl: './art-work-summary.component.html',
    /*styles: [`
    .square {
        width:50%;
    }

    .square:after {
        content: "";
        display: block;
        padding-bottom: 100%;
    }
    `]*/
})
export class ArtWorkSummaryComponent implements AfterViewInit {
    @ViewChild("canvas")
    canvas

    private context: CanvasRenderingContext2D
    private _artWork: Model.ArtWork = null

    constructor(
        public state: State
    ) { }

    @Input()
    set artWork(artWork) {
        this._artWork = artWork

        this.paint()
    }

    get artWork() {
        return this._artWork
    }

    updatePainting() {
        this.paint()
        return ""
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