export interface Observable<T> {
    subscribe(handler: (event) => any): {
        unsubscribe()
    }
}

export interface UserSpecification {
    id: string
    pseudo?: string
    publicKey: string
}

export interface AskSummary {
    id: string
    creator: string
    title: string
    // id of an Ask is id of AskSummary + order in the asks list
    asks: {
        description: string
        acceptedBidId: string
    }[]
}

export interface Bid {
    id: string

    askSummaryId: string
    askIndex: number

    price: number

    // human readable text description
    description: string

    // machine understandable (for showing an icon, a color etc...)
    specification: string
}

export interface State {
    signedUser: UserSpecification
    account?: {
        items: any[]
        coins: number
    }
}

/**
 * User register smart contract
 * 
 * methods
 * - register a user + public key
 * - signIn(signed id): returns true if the user identity proof is valid
 * 
 * state
 * - registered users
 */

/**
 * SupplyChain smart contract
 * 
 * methods
 * - createAccount
 * - publishBids
 * - selectOffer
 * - closeBids
 * - publishOffer
 */

/**
 * 
 * Each action is asynchronous: it is sent to the miner,
 * so application sometimes need to to wait on blockchain updates
 * 
 */
export interface SupplyChainEngine {
    /**
     * Updates about state change
     */
    states(): Observable<void>

    /**
     * Returns everything about this supply chain as a JS plain object, better later
     */
    getState(): any

    /**
     * SignIn
     * 
     * register the current user, engine state will evolve to registered user if successful
     * 
     * we are :
     * - signed on when the identity contract has a user with the same id and secret revealing the same
     * - not signed if the identity contract has the same user id but not the same publicKey
     * - unknown elsewhere
     */
    signInUser(id: string, packedAndSignedId: string)

    /**
     * User registration
     * 
     * calls the IdentitySmartContract to register the user
     * (only if it does not already exist)
     */
    registerUser(specification: UserSpecification)

    /** 
    * Call the SupplyChain contract to create an account,
    * the smart contract will affect initial items and coins if
    * the account does not already exist
     */
    createAccount(creatorId: PackedAndSigned<string>)

    /**
     * Ask :
     * 
     * - initiated : public, but not yet closed. offers are made against this Bids
     * - closed : all asks are fullfilled => coins and items are updated
     */
    publishAsk(description: PackedAndSigned<AskSummary>)

    /**
     * Select an offer, signed with the ask creator
     * 
     * The offer is then unavailable for other participants
     * When all ask's offers have been selected, the ask is closed and coins and items are updated
     * 
     * All that happens only if the provider has enough coins !
     */
    selectBid(bidId: PackedAndSigned<string>)

    /**
     * Offer :
     * 
     * - not selected : (the offer is selected by the first Bids in the chain to select it)
     * - selected : the offer has been selected by the ask made for it
     */
    publishBid(bid: PackedAndSigned<Bid>)
}

export type PackedAndSigned<T> = string