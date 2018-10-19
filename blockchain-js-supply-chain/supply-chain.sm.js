/**
 * This is a Supply Chain smart contract implementation
 * 
 * Askers ask and Biders bid.
 * 
 * All of them must be registered.
 * 
 * Identity is provided by the 'identity-registry-1' contract
 * 
 * TODO
 * 
 * from time to time give randomly choosen user a randomly choosen item (to incentive to use the chain)
 * 
 * grouper par lot :
 * on ne peut revendre les parties
 * mais on peut vendre un ensemble (itemId devient celui du ask validé)
 */
((() => {
    const NB_ITEMS_PACKET_AT_ACCOUNT_CREATION = 20
    const PACKET_QUANTITY = 1

    const canValidateArtWork = (artWork) => {
        return artWork.grid && artWork.grid.every(cell => !cell || cell.ownerId != null)
    }

    const addParticipations = (artWork, participations) => {
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
                addParticipations(this.data.artWorks[cell.workItemId.substr('artwork-'.length)], participations)
            }
            else {
                console.error(`unkown item id`)
            }
        })
    }

    const pickRedistributableItem = () => {
        return this.data.redistributableItems[Math.ceil(this.data.redistributableItems.length * Math.random())]
    }

    return {
        /**
         */
        init: function () {
            this.data = {
                redistributableItems: [
                    "pixel-red",
                    "pixel-green",
                    "pixel-blue",
                    "pixel-purple",
                    "emoji-😁",
                    "emoji-💛",
                    "emoji-🎷"
                ],

                accounts: {},

                artWorks: {}
            }
        },

        /** 
        * @param data { email }, signed by the email's public key on identity smart contract
         */
        createAccount: function (args) {
            console.log(`creating account...`)

            let signInData = callContract('identity-registry-1', 0, 'signIn', args)
            if (!signInData || !signInData.email) {
                console.log(`signIn failed`)
                return null
            }

            let email = signInData.email

            if (this.data.accounts[email]) {
                console.log(`already exists account for ${email}`)
                return null
            }

            let random = (modulo) => {
                let randomString = callContract('random-generator-v1', 0, 'generate', args)
                let result = parseInt(randomString.substr(0, 8), 16)
                return result % modulo
            }

            let items = {}

            for (let i = 0; i < NB_ITEMS_PACKET_AT_ACCOUNT_CREATION; i++) {
                let item = this.data.redistributableItems[random(this.data.redistributableItems.length)]
                if (item in items)
                    items[item] += PACKET_QUANTITY
                else
                    items[item] = PACKET_QUANTITY
            }

            this.data.accounts[email] = {
                email,
                inventory: items
            }

            console.log(`account registered!`, this.data.accounts[email])

            return this.data.accounts[email]
        },

        hasAccount: function (args) {
            if (!lib.checkStringArgs(args, ['email']))
                return false

            return args.email in this.data.accounts
        },




        registerArtWork: function (args) {
            if (!lib.checkArgs(args, ['artWork'])) {
                console.log(`missing artWork argument`)
                return false
            }

            let artWork = args['artWork']

            if (this.data.artWorks[artWork.id]) {
                console.log(`artwork ${artWork.id} already exists`)
                return false
            }

            // TODO sanity check

            this.data.artWorks[artWork.id] = artWork

            if (!this.data.accounts[artWork.author].inventory['artwork-' + artWork.id])
                this.data.accounts[artWork.author].inventory['artwork-' + artWork.id] = 0
            this.data.accounts[artWork.author].inventory['artwork-' + artWork.id]++

            return true
        },


        validateArtWork: function (args) {
            if (!lib.checkArgs(args, ['artWorkId'])) {
                console.log(`missing artWorkId argument`)
                return false
            }

            let artWorkId = args['artWorkId']

            let artWork = this.data.artWorks[artWorkId]
            if (!artWork)
                return false

            if (!canValidateArtWork(artWork))
                return false

            artWork.validated = true

            // redistribute goods
            this.data.redistributableItems.push('artwork-' + artWork.id)
            // compte les participations par personne
            let participations = {}
            addParticipations(artWork, participations)

            for (let userId in participations) {
                let count = participations[userId]
                while (count--) {
                    let winnedItemId = pickRedistributableItem()
                    let inventory = this.data.accounts[userId].inventory
                    if (!inventory[winnedItemId])
                        inventory[winnedItemId] = 1
                    else
                        inventory[winnedItemId]++
                }
            }
        },



        acceptGivingItem: function (args) {
            if (!lib.checkArgs(args, ['userId', 'itemId', 'artWorkId']))
                return false

            let userId = args['userId']
            let itemId = args['itemId']
            let artWorkId = args['artWorkId']

            if (this.data.accounts[userId].inventory[itemId] <= 0)
                return false

            const artWork = this.data.artWorks[artWorkId]
            if (!artWork || artWork.validated)
                return false

            let fittingCell = artWork.grid.find(cell => cell && cell.workItemId == itemId && !cell.ownerId)
            if (!fittingCell)
                return false

            fittingCell.ownerId = userId
            this.data.accounts[userId].inventory[itemId]--

            return true
        },


        removeCellFromArtWork: function (args) {
            if (!lib.checkArgs(args, ['artWorkId', 'x', 'y']))
                return false

            let artWorkId = args['artWorkId']
            let x = args['x']
            let y = args['y']

            const artWork = this.data.artWorks[artWorkId]
            if (!artWork)
                return false

            let coordIndex = x + artWork.size.width * y

            let ownerId = artWork.grid[coordIndex].ownerId
            let itemId = artWork.grid[coordIndex].workItemId

            artWork.grid[coordIndex] = null

            if (ownerId) {
                if (ownerId == artWork.author) { // cannot reverse an agreement !
                    if (!this.data.accounts[ownerId].inventory[itemId])
                        this.data.accounts[ownerId].inventory[itemId] = 0
                    this.data.accounts[ownerId].inventory[itemId]++
                }
            }

            return true
        },


        addItemInArtWorkFromInventory: function (args) {
            if (!lib.checkArgs(args, ['artWorkId', 'itemId', 'x', 'y']))
                return false

            let artWorkId = args['artWorkId']
            let itemId = args['itemId']
            let x = args['x']
            let y = args['y']

            const artWork = this.data.artWorks[artWorkId]
            if (!artWork)
                return false

            if (this.data.accounts[artWork.author].inventory[itemId] > 0) {
                let coordIndex = x + artWork.size.width * y
                artWork.grid[coordIndex] = {
                    ownerId: artWork.author,
                    workItemId: itemId
                }

                this.data.accounts[artWork.author].inventory[itemId]--
            }

            return true
        },


        askItemForArtWork: function (args) {
            if (!lib.checkArgs(['artWorkId', 'itemId', 'x', 'y']))
                return false

            let artWorkId = args['artWorkId']
            let itemId = args['itemId']
            let x = args['x']
            let y = args['y']

            const artWork = this.data.artWorks[artWorkId]
            if (!artWork)
                return false

            let coordIndex = x + artWork.size.width * y

            artWork.grid[coordIndex] = {
                ownerId: null,
                workItemId: itemId
            }

            return true
        },

        sendMessageOnArtWork: function (args) {
            if (!lib.checkArgs(['userId', 'artWorkId', 'text']))
                return false

            let userId = args['userId']
            let artWorkId = args['artWorkId']
            let text = args['text']

            this.data.artWorks[artWorkId].messages.push({ author: userId, text })

            return true
        },



        updateArtWorkTitle: function (args) {
            if (!lib.checkArgs(['artWorkId', 'title']))
                return false

            let artWorkId = args['artWorkId']
            let title = args['title']

            const artWork = this.data.artWorks[artWorkId]
            if (!artWork)
                return false

            artWork.title = title

            return true
        },



        updateArtWorkDescription: function (args) {
            if (!lib.checkArgs(['artWorkId', 'description']))
                return false

            let artWorkId = args['artWorkId']
            let description = args['description']

            const artWork = this.data.artWorks[artWorkId]
            if (!artWork)
                return false

            artWork.description = description

            return true
        },



        updateArtWorkSize: function (args) {
            if (!lib.checkArgs(['artWorkId', 'width', 'height']))
                return false

            let artWorkId = args['artWorkId']
            let width = args['width']
            let height = args['height']

            const artWork = this.data.artWorks[artWorkId]
            if (!artWork)
                return false

            artWork.size.width = width
            artWork.size.height = height

            this.updateArtWorkGrid(artWork)

            return true
        },

        updateArtWorkGrid(args) {
            if (!lib.checkArgs(['artWork']))
                return false

            let artWork = args['artWork']

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

            return true
        }
    }
})())