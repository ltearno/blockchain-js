return {
    /**
     * identity registry
     * 
     * register user
     */
    init: function () {
        this.data.identities = {}
    },

    registerIdentity: function (args) {
        if (!['email', 'publicKey', 'comment'].every(m => m in args)) {
            console.warn('missing argument')
            return false
        }

        if (!['email', 'publicKey', 'comment'].every(m => typeof args[m] === 'string')) {
            console.warn('wrong argument type')
            return false
        }

        let {
            email,
            publicKey,
            comment
        } = args

        if (email in this.data.identities) {
            console.warn(`already registered identity ${email}`)
            return false
        }

        this.data.identities[email] = {
            email,
            publicKey,
            comment
        }

        console.log(`registered identity ${email}`)
        return true
    }
}