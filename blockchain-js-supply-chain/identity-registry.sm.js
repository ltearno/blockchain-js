/**
 * This is a VERY VERY basic identity server
 * 
 * Really the main problem is reapay attacks.
 * 
 * There is a scheme to prevent that that I invented, will be implemented later on
 */
({
    /**
     * identity registry
     * 
     * register user
     */
    init: function () {
        this.data.identities = {}
    },

    registerIdentity: function (args) {
        let signedData = lib.extractPackedDataBody(args)
        if (!lib.checkStringArgs(signedData, ['id']))
            return null

        if (!lib.verifyPackedData(args)) {
            console.warn(`signature invalid for registerIdentity ${JSON.stringify(signedData)}`)
            return null
        }

        let publicKey = lib.extractPackedDataPublicKey(args)

        let {
            id,
            pseudo // optional
        } = signedData

        if (id in this.data.identities) {
            if (this.data.identities[id].publicKey == publicKey)
                return true

            console.warn(`already registered identity ${id}, with a different public key`)
            return null
        }

        this.data.identities[id] = {
            publicKey,
            pseudo
        }

        console.log(`registered identity ${id}`)
        return true
    },

    setPseudo: function (args) {
        let signedData = callContract('identity-registry-1', 0, 'signIn', args)
        if (!signedData)
            return

        if (!lib.checkStringArgs(signedData, ['id', 'pseudo']))
            return null

        let id = signedData.id

        console.log(`pseudo changed from '${this.data.identities[id].pseudo}' to '${signedData.pseudo}' for identity ${id}`)

        this.data.identities[id].pseudo = signedData.pseudo
    },

    /**
     * check identity
     */
    signIn: function (args) {
        let signedData = lib.extractPackedDataBody(args)

        if (!lib.checkStringArgs(signedData, ['id']))
            return null

        let signedId = signedData.id
        if (!(signedId in this.data.identities)) {
            console.warn(`user ${signedId} not registered for signIn`)
            return null
        }

        let knownIdentity = this.data.identities[signedId]
        let publicKey = lib.extractPackedDataPublicKey(args)
        if (publicKey !== knownIdentity.publicKey) {
            console.warn(`key invalid for signIn`)
            return null
        }

        if (!lib.verifyPackedData(args)) {
            console.warn(`signature invalid for signIn ${signedId}`)
            return null
        }

        return signedData
    }
})