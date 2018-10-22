import { Component, ChangeDetectorRef, OnInit, Output, EventEmitter, OnDestroy } from "@angular/core";
import { State } from "./state";


@Component({
    selector: 'supply-chain-overview',
    templateUrl: 'supply-chain-overview.component.html'
}
)
export class SupplyChainOverviewComponent implements OnInit, OnDestroy {
    private smartContractChangeListener = () => this.changeDetectionRef.detectChanges()

    constructor(private changeDetectionRef: ChangeDetectorRef,
        private state: State) {
        this.changeDetectionRef.detach()
        this.state.smartContract.addChangeListener(this.smartContractChangeListener)
    }

    ngOnInit() {
        this.changeDetectionRef.detectChanges()
    }

    ngOnDestroy() {
        this.state.smartContract.removeChangeListener(this.smartContractChangeListener)
    }

    artWorksToDisplay() {
        return Object.keys(this.state.programState.artWorks).sort().map(k => this.state.programState.artWorks[k])
    }

    @Output()
    initArtWorkCreation = new EventEmitter<void>()

    @Output()
    editArtWork = new EventEmitter<string>()

    private tempInventory = null

    get countUsers() {
        return Object.keys(this.state.programState.accounts).length
    }

    get inventory() {
        let inv = this.state.programState.accounts[this.state.user.pseudo].inventory
        let claims = this.claimsByOthers()
        let tempInventory = Object.keys(inv).map(itemId => ({ id: itemId, count: inv[itemId], claimsBy: claims[itemId] })).filter(item => item.count > 0)

        if (!this.tempInventory || JSON.stringify(tempInventory) != JSON.stringify(this.tempInventory)) {
            this.tempInventory = tempInventory
        }

        return this.tempInventory
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