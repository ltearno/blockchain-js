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
    users = []
    accounts = []
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

        this.users = []
        let accounts = this.state.smartContract.getContractState(this.state.SUPPLY_CHAIN_CONTRACT_ID).accounts
        Object.keys(this.state.programState.accounts)
            .forEach(id => {
                let data = {
                    id,
                    pseudo: this.state.identities[id].pseudo,
                    publicKey: this.state.identities[id].publicKey
                }

                if (accounts[id])
                    Object.keys(accounts[id]).forEach(key => data[key] = accounts[id][key])

                this.users.push(data)
            })

        this.artWorksToDisplay = Object.keys(this.state.programState.artWorks).sort((id1, id2) => {
            return this.state.programState.artWorks[id1].serialNumber > this.state.programState.artWorks[id2].serialNumber ? -1 : 1
        })
    }
}