import { Component, ChangeDetectorRef, OnInit, Output, EventEmitter, OnDestroy } from "@angular/core";
import { State } from "./state";
import * as Paint from './paint'


@Component({
    selector: 'supply-chain-overview',
    templateUrl: 'supply-chain-overview.component.html'
}
)
export class SupplyChainOverviewComponent implements OnDestroy, OnInit {
    private smartContractChangeListener = () => {
        this.updateModel()
        if (!this.changeDetectionRef['destroyed'])
            this.changeDetectionRef.detectChanges()
    }

    constructor(private changeDetectionRef: ChangeDetectorRef,
        private state: State) {
        this.state.smartContract.addChangeListener(this.smartContractChangeListener)
    }

    ngOnInit() {
        this.updateModel()
    }

    ngOnDestroy() {
        this.state.smartContract.removeChangeListener(this.smartContractChangeListener)
    }

    @Output()
    initArtWorkCreation = new EventEmitter<void>()

    @Output()
    editArtWork = new EventEmitter<string>()

    @Output()
    selectArtWork = new EventEmitter<string>()

    artWorksToDisplay = []
    countUsers = 0
    inventoryNbPixels = 0
    inventoryNbEmojis = 0

    private updateModel() {
        this.inventoryNbPixels = 0
        this.inventoryNbEmojis = 0

        if (!this.state.user || !this.state.programState.accounts[this.state.user.id])
            return

        let inv = this.state.programState.accounts[this.state.user.id].inventory

        Object.keys(inv)
            .forEach(itemId => {
                if (itemId.startsWith('pix'))
                    this.inventoryNbPixels += inv[itemId]
                else
                    this.inventoryNbEmojis += inv[itemId]
            })

        this.countUsers = Object.keys(this.state.programState.accounts).length

        this.artWorksToDisplay = Object.keys(this.state.programState.artWorks).sort()
    }
}