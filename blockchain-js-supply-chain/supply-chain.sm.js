/**
 * This is a Supply Chain smart contract implementation
 * 
 * Askers ask and Biders bid.
 * 
 * All of them must be registered.
 * 
 * Identity is provided by the 'identity-registry-1' contract
 */
((() => {
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

            let signInData = callContract(null, 'identity-registry-1', 0, 'signIn', args)
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
                let randomString = callContract(null, 'random-generator-v1', 0, 'generate', args)
                let result = parseInt(randomString.substr(0, 8), 16)
                return result % modulo
            }

            this.data.users[email] = {
                items: ['wood', 'water', 'ball'],
                balance: 10
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
            let ask = callContract(null, 'identity-registry-1', 0, 'signIn', args)
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
            let bid = callContract(null, 'identity-registry-1', 0, 'signIn', args)
            if (!bid) {
                console.log(`signIn failed`)
                return null
            }

            if (!lib.checkStringArgs(bid, ['email', 'id', 'askId', 'description', 'specification']))
                return null
            if (!lib.checkArgs(bid, ['askIndex', 'price']))
                return null

            if (bid.id in this.data.bids) {
                console.log(`bid ${bid.id} already exists`)
                return null
            }

            this.data.bids[bid.id] = bid

            console.log(`'bid' ${bid.id} just added !`)

            return true
        },

        selectBid: function (args) {
            let selection = callContract(null, 'identity-registry-1', 0, 'signIn', args)
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

            debugger;

            // transfer money
            let buyer = this.data.users[ask.email]
            let seller = this.data.users[bid.email]
            if (buyer.balance < bid.price) {
                console.log(`buyer does not have enough money ${buyer.balance} ${bid.price} !`)
                return null
            }

            askItem.bidId = bid.id
            buyer.balance -= bid.price
            seller.balance += bid.price
            // TODO : remove item from the seller

            console.log(`bid successfully selected !!!`)

            return true
        }
    }
})())