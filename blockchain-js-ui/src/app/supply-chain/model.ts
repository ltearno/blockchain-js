export interface ProgramState {
    accounts: { [id: string]: Account }
    groupWorks: { [id: string]: GroupWork }
}

export interface Account {
    email: string

    inventory: {
        [workItemId: string]: number
    }
}

export interface GroupWork {
    id: string
    title: string
    description: string
    author: string
    size: { width: number; height: number }
    grid: {
        workItemId: string // id de l'item `groupwork-XXX`, `artwork-XXX`, `pixel-XXX`, `emoji-XXX`
        ownerId: string // le possesseur initial
        accepted: boolean // contrat accepté avec le possesseur, pour celui-ci, l'objet disparait de son inventaire
    }[] // by line
}

export function findGroupWorkCompatibleAvailableWorkItems() {
    // work items not yet accepted and of the same size (and not in the current grid)
}

export function isGroupWorkValidated() {
    // is the whole grid filled with accepted WorkItems ?
}

export function findGroupWorkProposals(workItemId: string) {
    // find the GroupWorks that mention the `workItemId` in their grid
}

export function acceptProposal() {
    // confirm a workitem inside a groupwork
    // workitem owner looses it from its inventory
    // if the groupwork is validated, new work items are given to groupwork participants
}