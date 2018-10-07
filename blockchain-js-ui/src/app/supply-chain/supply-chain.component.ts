import { Component, OnInit } from '@angular/core'

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
    lotSize: { width: number; height: number }
    size: { width: number; height: number }
    grid: {
        workItemId: string // id de l'item `groupwork-XXX`, `artwork-XXX`, `pixel-XXX`, `emoji-XXX`
        ownerId: string // le possesseur
        accepted: boolean // contrat accepté avec le possesseur, pour celui-ci, l'objet disparait de son inventaire
    }[] // by line
    validated: boolean
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

@Component({
    selector: 'supply-chain',
    templateUrl: './supply-chain.component.html',
    styleUrls: ['./supply-chain.component.css']
})
export class SupplyChainComponent {
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

    creations = [
        {
            creator: 'me',
            name: 'Ile paradisiaque',
            description: 'On souhaite créer une ile où il fait bon vivre. Proposez des zones interressantes et variées !',
            zoneSize: { width: 15, height: 15 },
            size: { width: 10, height: 10 },
            nbAvailableOffers: 3, // should be processed from the data structure
            lotGrid: [
                {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {},
                {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {},
                {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {},
                {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}
            ]
        },
        {
            creator: 'lolite',
            name: 'Hopitâl',
            description: 'Un grand H en noir sur blanc, contribuez par des lots noirs.',
            zoneSize: { width: 3, height: 3 },
            size: { width: 5, height: 5 },
            nbAvailableOffers: 3,
            lotGrid: [{}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}]
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