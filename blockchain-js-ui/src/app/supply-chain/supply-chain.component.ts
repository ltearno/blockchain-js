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
        return Object.keys(inv).map(itemId => ({ id: itemId, count: inv[itemId] }))
    }

    /**
     * ArtWork creation
     */

    editingArtwork: Model.ArtWork = null

    initArtWorkCreation() {
        this.editingArtwork = {
            id: `r${Math.random()}`,
            author: this.state.userId,
            title: '',
            description: '',
            validated: false,
            size: { width: 4, height: 4 },
            grid: null
        }
    }

    editArtWork(artwork) {
        this.editingArtwork = artwork
    }

    validateArtwork() {
        this.state.programState.artWorks[this.editingArtwork.id] = this.editingArtwork
        // TODO this.state.programState.accounts[this.userId].inventory[this.editingArtwork.id]++
        this.editingArtwork = null
    }

    cancelArtwork() {
        this.editingArtwork = null
    }
}  