import { Component, Input, Output, EventEmitter, OnDestroy, ChangeDetectorRef } from '@angular/core'
import * as Model from './model'
import { State } from './state'

@Component({
    selector: 'art-work-detail',
    templateUrl: './art-work-detail.component.html',
    styles: [`
    .selected {
        border: 1px solid black;
    }
    `]
})
export class ArtWorkDetailComponent implements OnDestroy {
    private smartContractChangeListener = () => {
        this.updateFromContract()
        this.changeDetectorRef.detectChanges()
    }

    @Input()
    artWorkId: string = null

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
    }

    artWork: Model.ArtWork = null

    pseudoOrId(id: string) {
        return (this.state.identities[id] && this.state.identities[id].pseudo) || id
    }
}
