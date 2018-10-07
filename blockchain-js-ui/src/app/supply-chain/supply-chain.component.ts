import { Component, OnInit, ViewChild, AfterViewInit } from '@angular/core'

/**
 * Vocabulaire
 * 
 * WorkItem : can be
 * - a GroupWork,
 * - an ArtWork,
 * - a Pixel,
 * - an Emoji
 * - accepted or not by the owner
 * 
 * GroupWork // travail de groupe =
 * - identifiant
 * - titre
 * - description
 * - auteur
 * - taille des lots (en cases)
 * - taille de la zone de travail (en lots)
 * 
 * - grille = Lxl
 * 
 * () offres compatibles disponibles
 */

interface ProgramState {
    accounts: { [id: string]: Account }
    groupWorks: { [id: string]: GroupWork }
    artWorks: { [id: string]: ArtWork }
}

interface Account {
    email: string

    inventory: {
        [workItemId: string]: number
    }
}

interface GroupWork {
    id: string
    title: string
    description: string
    author: string
    zoneSize: { width: number; height: number }
    size: { width: number; height: number }
    grid: {
        workItemId: string // id de l'item `groupwork-XXX`, `artwork-XXX`, `pixel-XXX`, `emoji-XXX`
        ownerId: string // le possesseur
        accepted: boolean // contrat accepté avec le possesseur, pour celui-ci, l'objet disparait de son inventaire
    }[] // by line
}

function findGroupWorkCompatibleAvailableWorkItems() {
    // work items not yet accepted and of the same size (and not in the current grid)
}

function isGroupWorkValidated() {
    // is the whole grid filled with accepted WorkItems ?
}

interface ArtWork {
    id: string
    title: string
    description: string
    author: string
    size: { width: number; height: number }
    grid: string[] // by line, each cell's pixel/emoji or null
}

function findGroupWorkProposals(workItemId: string) {
    // find the GroupWorks that mention the `workItemId` in their grid
}

function acceptProposal() {
    // confirm a workitem inside a groupwork
    // workitem owner looses it from its inventory
    // if the groupwork is validated, new work items are given to groupwork participants
}

const WIDTH = 400
const HEIGHT = 400

function drawPixel(color: string, width: number, height: number, ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = color
    ctx.fillRect(0, 0, width, height)
}

function drawEmoji(text: string, width: number, height: number, ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = 'black'
    ctx.font = `${Math.min(width, height) * .64}px Verdana`

    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, width / 2, 1.1 * height / 2)
}

function drawArtWork(state: ProgramState, artWorkId: string, width: number, height: number, ctx: CanvasRenderingContext2D) {
    const artWork = state.artWorks[artWorkId]

    let CW = width / artWork.size.width
    let CH = height / artWork.size.height

    for (let i = 0; i < artWork.size.width; i++) {
        for (let j = 0; j < artWork.size.height; j++) {
            let value = artWork.grid[j * artWork.size.width + i]
            if (value) {
                ctx.save()
                ctx.translate(i * CW, j * CH)
                drawWorkItem(state, value, CW, CH, ctx)
                ctx.restore()
            }
        }
    }
}

function drawGroupWork(state: ProgramState, groupWorkId: string, width: number, height: number, ctx: CanvasRenderingContext2D) {
    const groupWork = state.groupWorks[groupWorkId]

    const CW = width / groupWork.size.width
    const CH = height / groupWork.size.height
    const PADDING = 1//CW / 20

    ctx.fillStyle = 'lightgrey'
    ctx.fillRect(0, 0, width, height)

    for (let i = 0; i < groupWork.size.width; i++) {
        for (let j = 0; j < groupWork.size.height; j++) {
            ctx.fillStyle = 'white'
            ctx.fillRect(i * CW + PADDING, j * CH + PADDING, CW - 2 * PADDING, CH - 2 * PADDING)

            let value = groupWork.grid[j * groupWork.size.width + i]
            if (value) {
                ctx.save()
                ctx.translate(i * CW + PADDING, j * CH + PADDING)
                drawWorkItem(state, value.workItemId, CW - 2 * PADDING, CH - 2 * PADDING, ctx)
                ctx.restore()
            }
        }
    }
}

function drawWorkItem(state: ProgramState, id: string, width: number, height: number, ctx: CanvasRenderingContext2D) {
    if (id.startsWith('pixel-')) {
        drawPixel(id.substr('pixel-'.length), width, height, ctx)
    }
    else if (id.startsWith('emoji-')) {
        drawEmoji(id.substr('emoji-'.length), width, height, ctx)
    }
    else if (id.startsWith('artwork-')) {
        drawArtWork(state, id.substr('artwork-'.length), width, height, ctx)
    }
    else if (id.startsWith('groupwork-')) {
        drawGroupWork(state, id.substr('groupwork-'.length), width, height, ctx)
    }
}

@Component({
    selector: 'supply-chain',
    templateUrl: './supply-chain.component.html',
    styleUrls: ['./supply-chain.component.css']
})
export class SupplyChainComponent implements AfterViewInit {
    @ViewChild("canvas")
    canvas

    private context: CanvasRenderingContext2D

    ngAfterViewInit() {
        let canvas = this.canvas.nativeElement
        this.context = canvas.getContext("2d")

        let state = {
            accounts: {},
            artWorks: {},
            groupWorks: {}
        }

        this.artWorks.forEach(a => state.artWorks[a.id] = a)
        this.groupWorks.forEach(g => state.groupWorks[g.id] = g)

        drawWorkItem(state, `groupwork-${this.groupWorks[0].id}`, WIDTH, HEIGHT, this.context)
    }

    userId = 'me'

    inventaire = [
        {
            id: 'pix-red',
            quantity: 2,
            selected: false // should be processed from the data structure
        },
        {
            id: 'pix-green',
            quantity: 1,
            selected: false
        },
        {
            id: 'emoji-😁',
            quantity: 3,
            selected: true
        }
    ]

    artWorks: ArtWork[] = [
        {
            id: 'oiuyhkjh',
            author: 'me',
            title: 'My forst artwirk',
            description: 'Un test',
            size: { width: 3, height: 3 },
            grid: [
                null, 'pixel-red', 'emoji-😁',
                'pixel-red', 'pixel-white', 'pixel-red',
                'emoji-😁', 'pixel-red', 'emoji-😂'
            ]
        }
    ]

    groupWorks: GroupWork[] = [
        {
            id: 'klkjhf',
            author: 'me',
            title: 'Ile paradisiaque',
            description: 'On souhaite créer une ile où il fait bon vivre. Proposez des zones interressantes et variées !',
            zoneSize: { width: 15, height: 15 },
            size: { width: 10, height: 10 },
            grid: [
                null, null, null, null, null, null, null, null, null, null,
                null, null, null, null, null, null, null, null, null, null,
                null, null, null, { ownerId: 'lolite', workItemId: 'groupwork-swujb', accepted: false }, null, null, null, null, null, null,
                null, null, null, null, null, null, null, null, null, null,
                null, null, null, null, null, null, null, null, null, null,
                null, null, null, null, null, null, null, null, null, null,
                null, null, null, null, null, null, null, null, null, null,
                null, { ownerId: 'lolite', workItemId: 'groupwork-swujb', accepted: false }, null, null, null, null, null, null, null, null,
                null, null, null, null, null, null, null, null, null, null,
                null, null, null, null, null, null, null, null, null, null
            ]
        },
        {
            id: 'swujb',
            author: 'lolite',
            title: 'Hopitâl',
            description: 'Un grand H en noir sur blanc, contribuez par des lots noirs.',
            zoneSize: { width: 3, height: 3 },
            size: { width: 5, height: 5 },
            grid: [
                { ownerId: 'lolite', workItemId: 'artwork-oiuyhkjh', accepted: false }, null, null, null, null,
                null, { ownerId: 'lolite', workItemId: 'artwork-oiuyhkjh', accepted: false }, null, null, null,
                null, null, { ownerId: 'lolite', workItemId: 'artwork-oiuyhkjh', accepted: false }, null, null,
                null, null, null, null, { ownerId: 'lolite', workItemId: 'artwork-oiuyhkjh', accepted: false },
                null, null, null, null, { ownerId: 'lolite', workItemId: 'artwork-oiuyhkjh', accepted: false }
            ]
        }
    ]

    /**
     * 
     */
    selectedCreation = null

    availableOffers = [
        {
            name: 'Jardin'
        },
        {
            name: 'Poste opératoire'
        },
        {
            name: 'Piscine'
        }
    ]
}  