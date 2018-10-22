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
            description: 'New and empty',
            validated: false,
            size: { width: 4, height: 4 },
            grid: new Array(4 * 4).fill(null),
            messages: []
        })

        this.editingArtworkId = id
    }

    editArtWork(artWorkId: string) {
        this.editingArtworkId = artWorkId
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

    acceptGivingItem(event: { itemId: string; artWorkId: string }) {
        this.state.suppyChain.acceptGivingItem(this.state.user.pseudo, event.itemId, event.artWorkId)
    }
}
