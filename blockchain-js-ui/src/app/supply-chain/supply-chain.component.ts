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

    userId = 'me'
    selectedCreation = null
    selectedArtWork = null

    inventaire = [
        {
            id: 'pix-red',
            quantity: 2,
            selected: false // should be processed from the data structure
        },
        {
            id: 'pix-green',
            quantity: 1,
            selected: false
        },
        {
            id: 'emoji-😁',
            quantity: 3,
            selected: true
        }
    ]

    /**
     * ArtWork creation
     */

    creatingArtWork: Model.ArtWork = null

    initArtWorkCreation() {
        this.creatingArtWork = {
            id: `r${Math.random()}`,
            author: this.userId,
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