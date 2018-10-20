import { Component } from '@angular/core'
import * as Model from './model'
import { State } from './state'

@Component({
    selector: 'supply-chain',
    templateUrl: './supply-chain.component.html',
    styleUrls: ['./supply-chain.component.css']
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

    get users() {
        return Object.keys(this.state.programState.accounts).join(', ')
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

    /**
     * ArtWork creation
     */

    editingArtworkId: string = null

    get editingArtwork(): Model.ArtWork {
        if (!this.editingArtworkId)
            return null

        return this.state.programState.artWorks[this.editingArtworkId]
    }

    async initArtWorkCreation() {
        let id = `r${Math.random()}`

        await this.state.suppyChain.registerArtWork({
            id: id,
            author: this.state.user.pseudo,
            title: 'New ArtWork',
            description: 'Very new and empty',
            validated: false,
            size: { width: 4, height: 4 },
            grid: new Array(4 * 4).fill(null),
            messages: []
        })

        this.editingArtworkId = id
    }

    editArtWork(artwork: Model.ArtWork) {
        this.editingArtworkId = artwork.id
    }

    async saveArtwork() {
        let editingArtwork = this.editingArtwork
        this.editingArtworkId = null

        if (this.state.programState.artWorks[editingArtwork.id] == editingArtwork)
            return

        await this.state.suppyChain.registerArtWork(editingArtwork)
    }

    cancelArtwork() {
        this.editingArtworkId = null
    }

    validateArtWork(artWork: Model.ArtWork) {
        this.state.suppyChain.validateArtWork(artWork.id)

        this.editingArtworkId = null
    }

    /**
     * Other
     */

    acceptGivingItem(itemId: string, artWorkId: string) {
        this.state.suppyChain.acceptGivingItem(this.state.user.pseudo, itemId, artWorkId)
    }
}
