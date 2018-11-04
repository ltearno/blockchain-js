import { Component, ChangeDetectorRef } from '@angular/core'
import * as Model from './model'
import { State } from './state'

@Component({
    selector: 'supply-chain',
    templateUrl: './supply-chain.component.html',
    styleUrls: ['./supply-chain.component.css']
})
export class SupplyChainComponent {
    constructor(
        public state: State,
        private changeDetectorRef: ChangeDetectorRef
    ) {
        this.state.smartContract.addChangeListener(this.smartContractChangeListener)
    }

    ngOnDestroy() {
        this.state.smartContract.removeChangeListener(this.smartContractChangeListener)
    }

    private smartContractChangeListener = () => {
        this.changeDetectorRef.detectChanges()
    }

    /**
     * ArtWork creation
     */

    editingArtworkId: string = null

    async initArtWorkCreation() {
        let id = `r${Math.random()}`

        await this.state.suppyChain.registerArtWork({
            id: id,
            author: this.state.user.pseudo,
            title: 'New ArtWork',
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

    validateArtWork() {
        if (this.editingArtworkId)
            this.state.suppyChain.validateArtWork(this.editingArtworkId)

        this.editingArtworkId = null
    }
}
