import { Component, OnInit, ViewChild, AfterViewInit, Inject } from '@angular/core'
import * as Model from './model'
import * as Paint from './paint'
import { State } from './state';

const WIDTH = 400
const HEIGHT = 400

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

    get inventory() {
        let inv = this.state.programState.accounts[this.state.userId].inventory

        let claims = this.claimsByOthers()

        return Object.keys(inv).map(itemId => ({ id: itemId, count: inv[itemId], claimsBy: claims[itemId] }))
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
                    claims[cell.workItemId].push(artWork.author)
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
            grid: null
        }
    }

    editArtWork(artwork) {
        this.editingArtwork = artwork
    }

    validateArtwork() {
        if (this.state.programState.artWorks[this.editingArtwork.id] == this.editingArtwork)
            return

        this.state.programState.artWorks[this.editingArtwork.id] = this.editingArtwork

        if (!this.state.programState.accounts[this.state.userId].inventory['artwork-' + this.editingArtwork.id])
            this.state.programState.accounts[this.state.userId].inventory['artwork-' + this.editingArtwork.id] = 0
        this.state.programState.accounts[this.state.userId].inventory['artwork-' + this.editingArtwork.id]++

        this.editingArtwork = null
    }

    cancelArtwork() {
        this.editingArtwork = null
    }
}  