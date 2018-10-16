import { ProgramState } from './model'
import { Injectable } from '@angular/core';

@Injectable()
export class State {
    userId: string = "ltearno@gmail.com"

    programState: ProgramState = {
        accounts: {
            "ltearno@gmail.com": {
                email: "ltearno@gmail.com",
                inventory: {
                    'pixel-red': 20,
                    'pixel-green': 3,
                    'emoji-😁': 5,
                    'oiuyhkjh': 1,
                    'klkjhf': 2
                }
            }
        },

        artWorks: {
            'klkjhf': {
                id: 'klkjhf',
                author: 'me',
                title: 'Ile paradisiaque',
                description: 'On souhaite créer une ile où il fait bon vivre. Proposez des zones interressantes et variées !',
                size: { width: 10, height: 10 },
                grid: [
                    null, null, null, null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null, null, null,
                    null, null, null, { ownerId: 'lolite', workItemId: 'artwork-swujb', accepted: false }, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null, null, null,
                    null, { ownerId: 'lolite', workItemId: 'artwork-oiuyhkjh', accepted: false }, null, null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null, null, null
                ]
            },

            'swujb': {
                id: 'swujb',
                author: 'lolite',
                title: 'Hopitâl',
                description: 'Un grand H en noir sur blanc, contribuez par des lots noirs.',
                size: { width: 5, height: 5 },
                grid: [
                    { ownerId: 'lolite', workItemId: 'artwork-oiuyhkjh', accepted: false }, null, null, null, null,
                    null, { ownerId: 'lolite', workItemId: 'artwork-oiuyhkjh', accepted: false }, null, null, null,
                    null, null, { ownerId: 'lolite', workItemId: 'artwork-oiuyhkjh', accepted: false }, null, null,
                    null, null, null, null, { ownerId: 'lolite', workItemId: 'artwork-oiuyhkjh', accepted: false },
                    null, null, null, null, { ownerId: 'lolite', workItemId: 'artwork-oiuyhkjh', accepted: false }
                ]
            },

            'oiuyhkjh': {
                id: 'oiuyhkjh',
                author: 'me',
                title: 'My forst artwirk',
                description: 'Un test',
                size: { width: 3, height: 3 },
                grid: [
                    { ownerId: 'lolite', accepted: false, workItemId: 'pixel-red' }, { ownerId: 'lolite', accepted: false, workItemId: 'pixel-red' }, { ownerId: 'lolite', accepted: false, workItemId: 'emoji-😁' },
                    { ownerId: 'lolite', accepted: false, workItemId: 'pixel-red' }, { ownerId: 'lolite', accepted: false, workItemId: 'pixel-white' }, { ownerId: 'lolite', accepted: false, workItemId: 'pixel-red' },
                    { ownerId: 'lolite', accepted: false, workItemId: 'emoji-😁' }, { ownerId: 'lolite', accepted: false, workItemId: 'pixel-red' }, { ownerId: 'lolite', accepted: false, workItemId: 'emoji-😂' }
                ]
            }
        }
    }
}