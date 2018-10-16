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

    creatingArtWork: Model.ArtWork = null

    initArtWorkCreation() {
        this.creatingArtWork = {
            id: `r${Math.random()}`,
            author: this.state.userId,
            title: '',
            description: '',
            size: { width: 4, height: 4 },
            grid: null
        }
    }

    validateArtwork() {
        this.state.programState.artWorks[this.creatingArtWork.id] = this.creatingArtWork
        // TODO this.state.programState.accounts[this.userId].inventory[this.creatingArtWork.id]++
        this.creatingArtWork = null
    }

    cancelArtwork() {
        this.creatingArtWork = null
    }
}  