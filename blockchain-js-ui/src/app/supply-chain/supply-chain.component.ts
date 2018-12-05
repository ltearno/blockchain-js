import { Component } from '@angular/core'
import { State } from './state'

@Component({
    selector: 'supply-chain',
    templateUrl: './supply-chain.component.html',
    styleUrls: ['./supply-chain.component.css']
})
export class SupplyChainComponent {
    constructor(
        public state: State
    ) {
        this.state.smartContract.addChangeListener(this.smartContractChangeListener)
    }

    nbUsers = 0
    nbPixels = 0
    nbEmojis = 0
    nbWinnedItems = 0
    position = 0

    artWorkCreationSize = {
        height: 7,
        width: 7
    }

    ngOnDestroy() {
        this.state.smartContract.removeChangeListener(this.smartContractChangeListener)
    }

    private smartContractChangeListener = () => {
        if (!this.state || !this.state.user || !this.state.user.id)
            return

        this.nbUsers = Object.keys(this.state.programState.accounts).length

        let account = this.state.programState.accounts[this.state.user.id]
        if (!account)
            return

        this.nbPixels = 0
        this.nbEmojis = 0
        Object.keys(account.inventory).forEach(itemId => {
            if (itemId.startsWith('pixel-'))
                this.nbPixels += account.inventory[itemId]
            else if (itemId.startsWith('emoji-'))
                this.nbEmojis += account.inventory[itemId]
        })
        
        this.nbWinnedItems = (account.nbWinnedPixels || 0) + (account.nbWinnedEmojis || 0)

        this.position = 1
        Object.keys(this.state.programState.accounts).forEach(id => {
            if (id == this.state.user.id)
                return

            let account = this.state.programState.accounts[id]
            let nbWinnedItems = (account.nbWinnedPixels || 0) + (account.nbWinnedEmojis || 0)

            if (nbWinnedItems > this.nbWinnedItems)
                this.position++
        })
    }

    /**
     * ArtWork creation
     */

    editingArtworkId: string = null

    isEditableArtWork() {
        return this.state.programState && this.state.programState.artWorks[this.editingArtworkId] && !this.state.programState.artWorks[this.editingArtworkId].validated && this.state.programState.artWorks[this.editingArtworkId].author == this.state.user.id
    }

    async initArtWorkCreation() {
        let id = `r${Math.random()}`

        await this.state.suppyChain.registerArtWork({
            id: id,
            author: this.state.user.id,
            title: '',
            validated: false,
            size: { width: this.artWorkCreationSize.width, height: this.artWorkCreationSize.height },
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
        if (this.editingArtworkId) {
            this.artWorkCreationSize.height = this.state.programState.artWorks[this.editingArtworkId].size.height
            this.artWorkCreationSize.width = this.state.programState.artWorks[this.editingArtworkId].size.width
            this.state.suppyChain.validateArtWork(this.editingArtworkId)
        }

        this.editingArtworkId = null
    }
}
