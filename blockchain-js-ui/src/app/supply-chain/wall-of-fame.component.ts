import { Component, OnDestroy, OnInit } from "@angular/core";
import { State } from "./state";

@Component({
    selector: 'wall-of-fame',
    templateUrl: './wall-of-fame.component.html'
})
export class WallOfFameComponent implements OnInit, OnDestroy {
    constructor(private state: State) { }

    users = []
    nbArtWorks = 0
    nbUsers = 0

    private maxes = new Map<string, number>()

    ngOnInit() {
        this.state.smartContract.addChangeListener(this.smartContractChangeListener)
        this.updateFromContract()
    }

    ngOnDestroy() {
        this.state.smartContract.removeChangeListener(this.smartContractChangeListener)
    }

    private smartContractChangeListener = () => {
        this.updateFromContract()
    }

    private updateFromContract() {
        this.users = []

        this.maxes = new Map<string, number>()
        let maybeStoreMax = (item: string, value: number) => {
            if (!this.maxes.has(item) || this.maxes.get(item) < value)
                this.maxes.set(item, value)
        }

        if (!this.state.programState || !this.state.programState.accounts)
            return

        this.nbArtWorks = Object.keys(this.state.programState.artWorks).length
        this.nbUsers = Object.keys(this.state.programState.accounts).length

        let artWorkUses = {}
        Object.keys(this.state.programState.artWorks).forEach(id => {
            Object.values(this.state.programState.artWorks[id].grid).forEach(usedWorkItemId => {
                if (!usedWorkItemId.startsWith('artwork-'))
                    return

                let usedArtWorkId = usedWorkItemId.substr('artwork-'.length)

                if (this.state.programState.artWorks[id].author == this.state.programState.artWorks[usedArtWorkId].author)
                    return

                if (artWorkUses[usedArtWorkId])
                    artWorkUses[usedArtWorkId]++
                else
                    artWorkUses[usedArtWorkId] = 1
            })
        })

        Object.keys(this.state.programState.accounts).forEach(id => {
            if (!this.state.identities || !this.state.identities[id])
                return

            let user: any = { id }
            user.pseudo = this.state.identities[id].pseudo
            user.publicKey = this.state.identities[id].publicKey
            user.publicKey = user.publicKey.substr(user.publicKey.indexOf('BEGIN PUBLIC KEY-----') + 'BEGIN PUBLIC KEY-----'.length)
            user.publicKey = user.publicKey.substr(0, user.publicKey.indexOf('-----END'))

            let account = this.state.programState.accounts[id]
            if (!account)
                return

            user.nbWinnedItems = account.nbWinnedEmojis + account.nbWinnedPixels
            user.nbWinnedEmojis = account.nbWinnedEmojis
            user.nbWinnedPixels = account.nbWinnedPixels
            user.nbConsumedArtWorks = account.nbConsumedArtWorks
            user.nbConsumedEmojis = account.nbConsumedEmojis
            user.nbConsumedPixels = account.nbConsumedPixels
            user.nbInventoryItems = 0
            Object.values(account.inventory).forEach(nb => user.nbInventoryItems += nb)

            maybeStoreMax('winned-items', user.nbWinnedItems)
            maybeStoreMax('winned-emojis', user.nbWinnedEmojis)
            maybeStoreMax('winned-pixels', user.nbWinnedPixels)
            maybeStoreMax('consumed-artworks', user.nbConsumedArtWorks)
            maybeStoreMax('consumed-emojis', user.nbConsumedEmojis)
            maybeStoreMax('consumed-pixels', user.nbConsumedPixels)
            maybeStoreMax('inventory-items', user.nbInventoryItems)

            user.artWorks = Object.keys(this.state.programState.artWorks).filter(artWorkId => this.state.programState.artWorks[artWorkId].author == user.id).map(artWorkId => {
                maybeStoreMax('artwork-uses', artWorkUses[artWorkId] || 0)

                return {
                    id: artWorkId,
                    title: this.state.programState.artWorks[artWorkId].title,
                    uses: artWorkUses[artWorkId] || 0,
                    messages: this.state.programState.artWorks[artWorkId].messages
                }
            }).sort((a, b) => {
                if (a.uses > b.uses)
                    return -1
                if (a.uses < b.uses)
                    return 1
                if (this.state.programState.artWorks[a.id].serialNumber > this.state.programState.artWorks[b.id].serialNumber)
                    return 1
                return -1
            })

            this.users.push(user)
        })

        this.users = this.users.sort((a, b) => {
            if (a.nbWinnedItems > b.nbWinnedItems)
                return -1
            if (a.nbWinnedItems < b.nbWinnedItems)
                return 1
            return 0
        })
    }

    isMax(item: string, value: number) {
        return this.maxes.has(item) && this.maxes.get(item) <= value
    }

    pseudoOrId(id: string) {
        return this.state.identities[id].pseudo || id
    }
}