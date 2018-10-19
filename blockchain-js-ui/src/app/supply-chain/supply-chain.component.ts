import { Component, OnInit, ViewChild, AfterViewInit, Inject } from '@angular/core'
import * as Model from './model'
import * as Paint from './paint'
import { State } from './state';

@Component({
    selector: 'supply-chain',
    templateUrl: './supply-chain.component.html',
    styleUrls: ['./supply-chain.component.css'],
    providers: [State]
})
export class SupplyChainComponent {
    constructor(
        public state: State
    ) { }

    artWorksToDisplay() {
        return Object.keys(this.state.programState.artWorks).sort().map(k => this.state.programState.artWorks[k])
    }

    selectedCreation = null
    selectedArtWork = null
    selectedInInventory = null

    private tempInventory = null

    get inventory() {
        let inv = this.state.programState.accounts[this.state.userId].inventory
        let claims = this.claimsByOthers()
        let tempInventory = Object.keys(inv).map(itemId => ({ id: itemId, count: inv[itemId], claimsBy: claims[itemId] }))

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

            artWork.grid.filter(cell => cell && !cell.ownerId && this.state.programState.accounts[this.state.userId].inventory[cell.workItemId] > 0)
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

    /**
     * ArtWork creation
     */

    editingArtwork: Model.ArtWork = null

    initArtWorkCreation() {
        this.editingArtwork = {
            id: `r${Math.random()}`,
            author: this.state.userId,
            title: 'New ArtWork',
            description: 'Very new and empty',
            validated: false,
            size: { width: 4, height: 4 },
            grid: null,
            messages: []
        }
    }

    editArtWork(artwork) {
        this.editingArtwork = artwork
    }

    saveArtwork() {
        let editingArtwork = this.editingArtwork
        this.editingArtwork = null

        if (this.state.programState.artWorks[editingArtwork.id] == editingArtwork)
            return

        Model.registerArtWork(this.state.programState, editingArtwork)
    }

    cancelArtwork() {
        this.editingArtwork = null
    }

    validateArtWork(artWork: Model.ArtWork) {
        Model.validateArtWork(this.state.programState, artWork.id)

        this.editingArtwork = null
    }

    /**
     * Other
     */

    acceptGivingItem(itemId: string, artWorkId: string) {
        Model.acceptGivingItem(this.state.programState, this.state.userId, itemId, artWorkId)
    }
}
