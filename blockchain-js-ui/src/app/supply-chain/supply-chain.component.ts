import { Component, OnInit } from '@angular/core'


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