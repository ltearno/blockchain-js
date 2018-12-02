import { Component, OnDestroy, OnInit } from "@angular/core";
import { State } from "./state";

@Component({
    selector: 'wall-of-fame',
    templateUrl: './wall-of-fame.component.html'
})
export class WallOfFameComponent implements OnInit, OnDestroy {
    constructor(private state: State) { }

    users = []

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

        if (!this.state.programState || !this.state.programState.accounts)
            return

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

            user.artWorks = Object.keys(this.state.programState.artWorks).filter(artWorkId => this.state.programState.artWorks[artWorkId].author == user.id).map(artWorkId => {
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
    }

    pseudoOrId(id: string) {
        return this.state.identities[id].pseudo || id
    }
}