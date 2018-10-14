export interface ProgramState {
    accounts: { [id: string]: Account }
    artWorks: { [id: string]: ArtWork }
}

export interface Account {
    email: string

    inventory: {
        [workItemId: string]: number
    }
}

export interface ArtWork {
    id: string
    title: string
    description: string
    author: string
    size: { width: number; height: number }
    grid: {
        workItemId: string // id de l'item `artwork-XXX`, `pixel-XXX`, `emoji-XXX`
        ownerId: string // le possesseur initial
        accepted: boolean // contrat accepté avec le possesseur, pour celui-ci, l'objet disparait de son inventaire
    }[] // by line
}

export function findArtWorkCompatibleAvailableWorkItems() {
    // work items not yet accepted and of the same size (and not in the current grid)
}

export function isArtWorkValidated() {
    // is the whole grid filled with accepted WorkItems ?
}

export function findArtWorkProposals(workItemId: string) {
    // find the ArtWorks that mention the `workItemId` in their grid
}

export function acceptProposal() {
    // confirm a workitem inside an artwork
    // workitem owner looses it from its inventory
    // if the artwork is validated, new work items are given to artwork participants
}