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

        // register the artwork

        this.state.programState.artWorks[editingArtwork.id] = editingArtwork

        if (!this.state.programState.accounts[this.state.userId].inventory['artwork-' + editingArtwork.id])
            this.state.programState.accounts[this.state.userId].inventory['artwork-' + editingArtwork.id] = 0
        this.state.programState.accounts[this.state.userId].inventory['artwork-' + editingArtwork.id]++
    }

    cancelArtwork() {
        this.editingArtwork = null
    }

    validateArtWork(artWork: Model.ArtWork) {
        if (!this.canValidate(artWork))
            return

        artWork.validated = true

        // redistribute goods
        this.state.programState.redistributableItems.push('artwork-' + artWork.id)
        // compte les participations par personne
        let participations = {}
        this.addParticipations(artWork, participations)
        // redistribuer entre tous les pixels/emojis + artworks validés enregistrés

        this.editingArtwork = null
    }

    // every cell is either innoccupied or ownerId has been set
    private canValidate(artWork: Model.ArtWork) {
        return artWork.grid && artWork.grid.every(cell => !cell || cell.ownerId != null)
    }

    private addParticipations(artWork: Model.ArtWork, participations: { [userId: string]: number }) {
        if (!artWork.validated)
            return

        if (!participations[artWork.author])
            participations[artWork.author] = 0
        participations[artWork.author]++

        artWork.grid.forEach(cell => {
            if (!cell)
                return

            if (cell.workItemId.startsWith('pixel-') || cell.workItemId.startsWith('emoji-')) {
                if (!participations[cell.ownerId])
                    participations[cell.ownerId] = 0
                participations[cell.ownerId]++
            }
            else if (cell.workItemId.startsWith('artwork-')) {
                this.addParticipations(this.state.programState.artWorks[cell.workItemId.substr('artwork-'.length)], participations)
            }
            else {
                console.error(`unkown item id`)
            }
        })

        console.log(`Participations`, participations)

        for (let userId in participations) {
            let count = participations[userId]
            while (count--) {
                let winnedItemId = this.pickRedistributableItem()
                let inventory = this.state.programState.accounts[userId].inventory
                if (!inventory[winnedItemId])
                    inventory[winnedItemId] = 1
                else
                    inventory[winnedItemId]++

                console.log(`user ${userId} won ${winnedItemId}`)
            }
        }
    }

    private pickRedistributableItem() {
        return this.state.programState.redistributableItems[Math.ceil(this.state.programState.redistributableItems.length * Math.random())]
    }

    /**
     * Other
     */

    acceptGivingItem(itemId: string, artWorkId: string) {
        if (this.state.programState.accounts[this.state.userId].inventory[itemId] <= 0)
            return
        const artWork = this.state.programState.artWorks[artWorkId]
        if (!artWork || artWork.validated)
            return

        let fittingCell = artWork.grid.find(cell => cell && cell.workItemId == itemId && !cell.ownerId)
        if (!fittingCell)
            return

        fittingCell.ownerId = this.state.userId
        this.state.programState.accounts[this.state.userId].inventory[itemId]--
    }
}
