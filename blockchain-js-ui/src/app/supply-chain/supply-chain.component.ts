import { Component, OnInit } from '@angular/core'

/**
 * Vocabulaire
 * 
 * WorkItem : can be
 * - a GroupWork,
 * - an ArtWork,
 * - a Pixel
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

interface GroupWork {
    id: string
    title: string
    description: string
    author: string
    lotSize: { width: number; height: number }
    size: { width: number; height: number }
    grid: {
        workItemId: string // id de l'item
        ownerId: string // le possesseur, peut etre il ne l'a plus d'ailleurs
    }[] // by line
}

function findGroupWorkCompatibleAvailableWorkItems() {
    // work items not yet accepted and of the same size (and not in the current grid)
}

function isGroupWorkValidated() {
    // is the whole grid filled with accepted WorkItems ?
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