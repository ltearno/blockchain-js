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
    author: string
    validated: boolean // if the ArtWork is finished (no further modifications allowed)
    size: { width: number; height: number }
    grid: {
        [cellPosition: string]: string // id de l'item `artwork-XXX`, `pixel-XXX`, `emoji-XXX`
    }
    messages: ChatMessage[]
}

export function canValidateArtWork(state: ProgramState, artWorkId: string) {
    if (!artWorkId || !state)
        return false

    const artWork = state.artWorks[artWorkId]
    if (!artWork)
        return false

    if (artWork.validated || !artWork.grid)
        return false

    return !Object.values(artWork.grid)
        .filter(workItemId => workItemId.startsWith('artwork-'))
        .map(workItemId => workItemId.substr('artwork-'.length))
        .some(artWorkId => !state.artWorks[artWorkId].validated)
}