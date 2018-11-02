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
    inventory = []

    private updateModel() {
        let inv = this.state.programState.accounts[this.state.user.pseudo].inventory
        let claims = this.claimsByOthers()
        this.inventory = Object.keys(inv).sort().map(itemId => ({ id: itemId, count: inv[itemId], claimsBy: claims[itemId] })).filter(item => item.count > 0)

        this.countUsers = Object.keys(this.state.programState.accounts).length

        this.artWorksToDisplay = Object.keys(this.state.programState.artWorks).sort()
    }

    @Output()
    giveItem = new EventEmitter<{ itemId: string; artWorkId: string }>()

    acceptGivingItem(itemId: string, artWorkId: string) {
        this.giveItem.emit({ itemId, artWorkId })
    }

    // les choses que je possède que les autres veulent
    private claimsByOthers() {
        let claims = {}

        for (let artWorkId in this.state.programState.artWorks) {
            let artWork = this.state.programState.artWorks[artWorkId]
            if (artWork.validated || !artWork.grid)
                continue

            artWork.grid.filter(cell => cell && !cell.ownerId && this.state.programState.accounts[this.state.user.pseudo].inventory[cell.workItemId] > 0)
                .forEach(cell => {
                    if (!claims[cell.workItemId])
                        claims[cell.workItemId] = []

                    let claimsForWorkItem = claims[cell.workItemId] as { userId: string; artWorkId: string }[]
                    if (!claimsForWorkItem.some(claim => claim.userId == artWork.author && claim.artWorkId == artWork.id))
                        claimsForWorkItem.push({ userId: artWork.author, artWorkId: artWork.id })
                })
        }

        return claims
    }
}