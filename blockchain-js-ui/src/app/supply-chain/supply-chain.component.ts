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
        if (!this.changeDetectorRef['destroyed'])
            this.changeDetectorRef.detectChanges()
    }

    /**
     * ArtWork creation
     */

    editingArtworkId: string = null

    isEditableArtWork() {
        return this.state.programState && this.state.programState.artWorks[this.editingArtworkId] && !this.state.programState.artWorks[this.editingArtworkId].validated && this.state.programState.artWorks[this.editingArtworkId].author == this.state.user.id
    }

    async initArtWorkCreation() {
        const SIZE = 7

        let id = `r${Math.random()}`

        await this.state.suppyChain.registerArtWork({
            id: id,
            author: this.state.user.id,
            title: 'Artwork',
            validated: false,
            size: { width: SIZE, height: SIZE },
            grid: null,
            messages: []
        })

        this.editingArtworkId = id
    }

    editArtWork(artWorkId: string) {
        this.editingArtworkId = artWorkId
    }

    selectArtWork(artWorkId: string) {
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
