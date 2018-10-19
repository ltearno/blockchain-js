export interface ProgramState {
    accounts: { [id: string]: Account }
    artWorks: { [id: string]: ArtWork }
    redistributableItems: string[]
}

export interface Account {
    email: string

    inventory: {
        [workItemId: string]: number
    }
}

export interface ChatMessage {
    author: string
    text: string
}

export interface ArtWork {
    id: string
    title: string
    description: string
    author: string
    validated: boolean // if the ArtWork is finished (all cells with workitems must be accepted)
    size: { width: number; height: number }
    grid: {
        workItemId: string // id de l'item `artwork-XXX`, `pixel-XXX`, `emoji-XXX`
        ownerId?: string // le possesseur initial
    }[] // by line
    messages: ChatMessage[]
}

export function registerArtWork(state: ProgramState, artWork: ArtWork) {
    if (state.artWorks[artWork.id])
        return

    state.artWorks[artWork.id] = artWork

    if (!state.accounts[artWork.author].inventory['artwork-' + artWork.id])
        state.accounts[artWork.author].inventory['artwork-' + artWork.id] = 0
    state.accounts[artWork.author].inventory['artwork-' + artWork.id]++
}

export function validateArtWork(state: ProgramState, artWorkId: string) {
    let artWork = state.artWorks[artWorkId]
    if (!artWork)
        return

    if (!canValidateArtWork(artWork))
        return

    artWork.validated = true

    // redistribute goods
    state.redistributableItems.push('artwork-' + artWork.id)
    // compte les participations par personne
    let participations = {}
    addParticipations(state, artWork, participations)

    for (let userId in participations) {
        let count = participations[userId]
        while (count--) {
            let winnedItemId = pickRedistributableItem(state)
            let inventory = state.accounts[userId].inventory
            if (!inventory[winnedItemId])
                inventory[winnedItemId] = 1
            else
                inventory[winnedItemId]++
        }
    }
}

export function canValidateArtWork(artWork: ArtWork) {
    return artWork.grid && artWork.grid.every(cell => !cell || cell.ownerId != null)
}

function addParticipations(state: ProgramState, artWork: ArtWork, participations: { [userId: string]: number }) {
    if (!artWork.validated)
        return

    if (!participations[artWork.author])
        participations[artWork.author] = 0
    participations[artWork.author]++

    artWork.grid.forEach(cell => {
        if (!cell)
            return

        if (cell.workItemId.startsWith('pixel-') || cell.workItemId.startsWith('emoji-')) {
            if (!participations[cell.ownerId])
                participations[cell.ownerId] = 0
            participations[cell.ownerId]++
        }
        else if (cell.workItemId.startsWith('artwork-')) {
            addParticipations(state, state.artWorks[cell.workItemId.substr('artwork-'.length)], participations)
        }
        else {
            console.error(`unkown item id`)
        }
    })
}

function pickRedistributableItem(state: ProgramState) {
    return state.redistributableItems[Math.ceil(state.redistributableItems.length * Math.random())]
}

// TODO add access controls
export function acceptGivingItem(state: ProgramState, userId: string, itemId: string, artWorkId: string) {
    if (state.accounts[userId].inventory[itemId] <= 0)
        return
    const artWork = state.artWorks[artWorkId]
    if (!artWork || artWork.validated)
        return

    let fittingCell = artWork.grid.find(cell => cell && cell.workItemId == itemId && !cell.ownerId)
    if (!fittingCell)
        return

    fittingCell.ownerId = userId
    state.accounts[userId].inventory[itemId]--
}

// TODO add access controls
export function removeCellFromArtWork(state: ProgramState, artWorkId: string, x: number, y: number) {
    const artWork = state.artWorks[artWorkId]
    if (!artWork)
        return

    let coordIndex = x + artWork.size.width * y

    let ownerId = artWork.grid[coordIndex].ownerId
    let itemId = artWork.grid[coordIndex].workItemId

    artWork.grid[coordIndex] = null

    if (ownerId) {
        if (ownerId == artWork.author) { // cannot reverse an agreement !
            if (!state.accounts[ownerId].inventory[itemId])
                state.accounts[ownerId].inventory[itemId] = 0
            state.accounts[ownerId].inventory[itemId]++
        }
    }
}

// TODO add access controls
export function addItemInArtWorkFromInventory(state: ProgramState, artWorkId: string, itemId: string, x: number, y: number) {
    const artWork = state.artWorks[artWorkId]
    if (!artWork)
        return

    if (state.accounts[artWork.author].inventory[itemId] > 0) {
        let coordIndex = x + artWork.size.width * y
        artWork.grid[coordIndex] = {
            ownerId: artWork.author,
            workItemId: itemId
        }

        state.accounts[artWork.author].inventory[itemId]--
    }
}

// TODO add access controls
export function askItemForArtWork(state: ProgramState, artWorkId: string, itemId: string, x: number, y: number) {
    const artWork = state.artWorks[artWorkId]
    if (!artWork)
        return

    let coordIndex = x + artWork.size.width * y

    artWork.grid[coordIndex] = {
        ownerId: null,
        workItemId: itemId
    }
}

export function sendMessageOnArtWork(state: ProgramState, userId: string, artWorkId: string, text: string) {
    state.artWorks[artWorkId].messages.push({ author: userId, text })
}

export function updateArtWorkTitle(state: ProgramState, artWorkId: string, title: string) {
    const artWork = state.artWorks[artWorkId]
    if (!artWork)
        return

    artWork.title = title
}

export function updateArtWorkDescription(state: ProgramState, artWorkId: string, description: string) {
    const artWork = state.artWorks[artWorkId]
    if (!artWork)
        return

    artWork.description = description
}

export function updateArtWorkSize(state: ProgramState, artWorkId: string, width: number, height: number) {
    const artWork = state.artWorks[artWorkId]
    if (!artWork)
        return

    artWork.size.width = width
    artWork.size.height = height

    updateArtWorkGrid(artWork)
}

export function updateArtWorkGrid(artWork: ArtWork) {
    let normalLength = artWork.size.width * artWork.size.height

    if (!artWork.grid) {
        artWork.grid = new Array(normalLength)
    }
    else if (artWork.grid.length < normalLength) {
        artWork.grid = artWork.grid.concat(new Array(normalLength - artWork.grid.length).fill(null))
    }
    else if (artWork.grid.length > normalLength) {
        artWork.grid.slice(0)
    }
}