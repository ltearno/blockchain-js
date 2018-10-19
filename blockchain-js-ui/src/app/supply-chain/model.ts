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