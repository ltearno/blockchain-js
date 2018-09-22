/**
 * This is a VERY VERY basic random generator
 * 
 * It has a lot of enthropy coming from the sharing degree of it (because of a lot of unpredictable use)
 */
({
    /**
     * identity registry
     * 
     * register user
     */
    init: function () {
        this.data.seed = lib.hash('0x666')
    },

    generate: function (args) {
        this.data.seed = lib.hash(lib.hash(this.data.seed) + JSON.stringify(args))
        return this.data.seed
    }
})