export interface Observable<T> {
    subscribe(handler: (event) => any): {
        unsubscribe()
    }
}

export interface UserSpecification {
    email: string
    comment: string
    publicKey: string
}

export interface Bids {
    id: string
    creatorEmail: string
    title: string
    asks: { id: string; description: string }
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
 * - signIn(signed email): returns true if the user identity proof is valid
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
     * - signed on when the identity contract has a user with the same email and secret revealing the same
     * - not signed if the identity contract has the same user email but not the same publicKey
     * - unknown elsewhere
     */
    signInUser(email: string, packedAndSignedEmail: string)

    /**
     * User registration
     * 
     * calls the IdentitySmartContract to register the user
     * (only if it does not already exist)
     * 
     * should maybe return a promise which successes with a 'userUuid' ?
     * NO => email is the userUuid, prove it with RSA signature !
     * 
     * TODO
     */
    registerUser(specification: UserSpecification)

    /** 
    * Call the SupplyChain contract to create an account,
    * the smart contract will affect initial items and coins if
    * the account does not already exist
     */
    createAccount(creatorEmail: PackedAndSigned<string>)

    /**
     * Bids :
     * 
     * - initiated : public, but not yet closed. offers are made against this Bids
     * - closed : all asks are fullfilled, all offers have been choosen by the initiator of the Bids, coins and items are updated
     */
    publishBids(description: PackedAndSigned<Bids[]>)

    // offerId signed by Bids creator
    selectOffer(offer: PackedAndSigned<string>)

    closeBids(Bids: PackedAndSigned<{ BidsId: string; }>)

    /**
     * Offer :
     * 
     * - not choosen : (the offer is selected by the first Bids in the chain to select it)
     */
    publishOffer(offer: PackedAndSigned<{ demandId: string; itemId: string; coins: number; description: string }>)
}

export type PackedAndSigned<T> = string