import { Component, OnInit, ViewChild, AfterViewInit, Input, Output, EventEmitter, group } from '@angular/core'
import * as Model from './model'
import * as Paint from './paint'
import { State } from './state'

@Component({
    selector: 'group-work-summary',
    templateUrl: './group-work-summary.component.html'
})
export class GroupWorkSummaryComponent implements AfterViewInit {
    @ViewChild("canvas")
    canvas

    private context: CanvasRenderingContext2D
    private _groupWork: Model.GroupWork = null

    constructor(
        public state: State
    ) { }

    @Input()
    userId: string

    @Input()
    set groupWork(groupWork) {
        this._groupWork = groupWork

        this.paint()
    }

    get groupWork() {
        return this._groupWork
    }

    @Output()
    select = new EventEmitter<Model.GroupWork>()

    ngAfterViewInit() {
        let canvas = this.canvas.nativeElement
        this.context = canvas.getContext("2d")
        
        this.paint()
    }

    private paint() {
        this._groupWork && this.context && Paint.drawGroupWork(this.state.programState, this._groupWork, 400, 400, this.context)
    }
}