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
        if (!lib.checkStringArgs(signedData, ['email', 'comment']))
            return null

        if (!lib.verifyPackedData(args)) {
            console.warn(`signature invalid for registerIdentity ${signedEmail}`)
            return null
        }

        let publicKey = lib.extractPackedDataPublicKey(args)

        let {
            email,
            comment
        } = signedData

        if (email in this.data.identities) {
            console.warn(`already registered identity ${email}`)
            return null
        }

        this.data.identities[email] = {
            publicKey,
            comment
        }

        console.log(`registered identity ${email}`)
        return true
    },

    /**
     * check identity
     */
    signIn: function (args) {
        let signedData = lib.extractPackedDataBody(args)

        if (!lib.checkStringArgs(signedData, ['email']))
            return null

        let signedEmail = signedData.email
        if (!(signedEmail in this.data.identities)) {
            console.warn(`user not registered for signIn`)
            return null
        }

        let knownIdentity = this.data.identities[signedEmail]
        let publicKey = lib.extractPackedDataPublicKey(args)
        if (publicKey !== knownIdentity.publicKey) {
            debugger;
            console.warn(`key invalid for signIn`)
            return null
        }

        if (!lib.verifyPackedData(args)) {
            console.warn(`signature invalid for signIn ${signedEmail}`)
            return null
        }

        //console.log(`signIn successful for ${signedEmail}`)

        return signedData
    }
})