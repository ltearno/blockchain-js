return {
    init: function() {
        this.data.registre = {}
    },

    register: function(args) {
        if(args.name in this.data.registre){
            console.warn('already registered name ' + args.name)
            return
        }
        
        this.data.registre[args.name] = args.ip

        console.log('registered name ' + args.name + ' to ' + args.ip)
    }
}