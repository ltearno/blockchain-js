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
    const ITEM_BASE = [
        'roue',
        'pédale',
        'guidon',
        'chaîne',
        'cadre',
        'freinage',
        'klaxon',
        'selle',
        'pneu',
        'éclairage'
    ]

    const BALANCE_AT_ACCOUNT_CREATION = 10

    const PACKET_QUANTITY = 10

    const NB_ITEMS_PACKET_AT_ACCOUNT_CREATION = 3

    let changeItemCount = (account, itemId, change) => {
        if (!(itemId in account.items))
            account.items[itemId] = change
        else
            account.items[itemId] += change
    }

    return {
        /**
         */
        init: function () {
            this.data.users = {}
            this.data.asks = {}
            this.data.bids = {}
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

            if (this.data.users[email]) {
                console.log(`already exists account for ${email}`)
                return null
            }

            let random = (modulo) => {
                let randomString = callContract('random-generator-v1', 0, 'generate', args)
                let result = parseInt(randomString.substr(0, 8), 16)
                return result % modulo
            }

            let items = {}

            // for debug, we know accounts will have this item
            //items[ITEM_BASE[0]] = PACKET_QUANTITY

            for (let i = 0; i < NB_ITEMS_PACKET_AT_ACCOUNT_CREATION; i++) {
                let item = ITEM_BASE[random(ITEM_BASE.length)]
                if (item in items)
                    items[item] += PACKET_QUANTITY
                else
                    items[item] = PACKET_QUANTITY
            }

            this.data.users[email] = {
                items,
                balance: BALANCE_AT_ACCOUNT_CREATION
            }

            console.log(`account registered!`, this.data.users[email])

            return this.data.users[email]
        },

        hasAccount: function (args) {
            if (!lib.checkStringArgs(args, ['email']))
                return false

            return args.email in this.data.users
        },

        getState: function () {
            return this.data
        },

        /**
         * Ask :
         * 
         * - initiated : public, but not yet closed. offers are made against this Bids
         * - closed : all asks are fullfilled => coins and items are updated
         * 
         * @param data { email, id, title, description, asks : { description: string, acceptedBidId: string }[] }, signed by the ask's creator's email's public key on identity smart contract
         */
        publishAsk: function (args) {
            let ask = callContract('identity-registry-1', 0, 'signIn', args)
            if (!ask) {
                console.log(`signIn failed`)
                return null
            }

            if (!lib.checkStringArgs(ask, ['email', 'id', 'title', 'description']))
                return null
            if (!lib.checkArgs(ask, ['asks']))
                return null

            if (ask.id in this.data.asks) {
                console.error(`ask already existing`)
                return null
            }

            this.data.asks[ask.id] = ask

            console.log(`'ask' ${ask.id} just added !`)

            return true
        },

        /**
         * Offer :
         * 
         * - not selected : (the offer is selected by the first Bids in the chain to select it)
         * - selected : the offer has been selected by the ask made for it
         */
        publishBid: function (args) {
            let bid = callContract('identity-registry-1', 0, 'signIn', args)
            if (!bid) {
                console.log(`signIn failed`)
                return null
            }

            if (!lib.checkStringArgs(bid, ['email', 'id', 'askId', 'itemId', 'description', 'specification']))
                return null
            if (!lib.checkArgs(bid, ['askIndex', 'price']))
                return null

            if (!(bid.email in this.data.users)) {
                console.log(`user has no account to publish bid !`)
                return
            }

            if (bid.id in this.data.bids) {
                console.log(`bid ${bid.id} already exists`)
                return null
            }

            if (!this.data.users[bid.email].items[bid.itemId]) {
                console.log(`insufficient items to bid ${bid.itemId} !`)
                return null
            }

            this.data.bids[bid.id] = bid

            console.log(`'bid' ${bid.id} just added !`)

            return true
        },

        // comment bid... (for discussions...)
        // change bid price
        // update ask...

        selectBid: function (args) {
            let selection = callContract('identity-registry-1', 0, 'signIn', args)
            if (!selection) {
                console.log(`signIn failed`)
                return null
            }

            if (!lib.checkStringArgs(selection, ['email', 'bidId']))
                return null

            let bid = this.data.bids[selection.bidId]
            if (!bid) {
                console.log(`unknown bid ${selection.bidId}`)
                return null
            }

            let ask = this.data.asks[bid.askId]
            if (!ask) {
                console.log(`unknown ask ${bid.askId} for bid ${bid.id}`)
                return null
            }

            if (selection.email !== ask.email) {
                console.log(`wrong user for selecting bid ${bid.askId} for bid ${bid.id}`)
                return null
            }

            if (bid.askIndex < 0 || bid.askIndex >= ask.asks.length) {
                console.log(`askIndex out of range in bid ${bid.askIndex}`)
                return null
            }

            let askItem = ask.asks[bid.askIndex]

            if (askItem.bidId) {
                console.log(`askItem already selected bid ${askItem.bidId}`)
                return null
            }

            // transfer money
            let buyer = this.data.users[ask.email]
            let seller = this.data.users[bid.email]

            if (buyer.balance < bid.price) {
                console.log(`buyer does not have enough money ${buyer.balance} ${bid.price} !`)
                return null
            }

            if (!(bid.itemId in seller.items) || seller.items[bid.itemId] <= 0) {
                console.log(`seller does not have the item ${bid.itemId}`)
                return null
            }

            askItem.bidId = bid.id
            bid.selected = true

            buyer.balance -= bid.price
            seller.balance += bid.price

            changeItemCount(seller, bid.itemId, -1)

            // when all asks have been fulfilled, buyer gets rewarded with a new item
            if (ask.asks.every(askItem => askItem.bidId != null)) {
                changeItemCount(buyer, ask.id, 1)
                console.log(`congratulations to user who just got his new item ${bid.id} !`)
            }

            console.error(`bid successfully selected !!!`)

            return true
        }
    }
})())