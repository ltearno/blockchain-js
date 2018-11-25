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

    artWorksToDisplay = []
    countUsers = 0
    inventoryNbItems = 0
    inventory = []

    private updateModel() {
        let inv = this.state.programState.accounts[this.state.user.id].inventory
        this.inventory = Object.keys(inv)
            .sort()
            .map(itemId => ({ id: itemId, count: inv[itemId] }))
            .filter(item => item.count > 0)

        this.inventoryNbItems = 0
        this.inventory.forEach(item => this.inventoryNbItems += item.count)

        this.countUsers = Object.keys(this.state.programState.accounts).length

        this.artWorksToDisplay = Object.keys(this.state.programState.artWorks).sort()
    }
}