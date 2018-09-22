import {
    Block,
    FullNode,
    ListOnChain,
    HashTools,
    KeyValueStorage,
    SequenceStorage,
    SmartContract,
    NodeBrowser,
    NetworkApi,
    NetworkClientBrowserImpl,
    NodeApi,
    NodeImpl,
    NodeTransfer,
    MinerImpl,
    NodeNetworkClient,
    WebsocketConnector
} from 'blockchain-js-core'

async function main() {
    let node = new NodeImpl.NodeImpl()
    let miner = new MinerImpl.MinerImpl(node)

    let smartContract = new SmartContract.SmartContract(node, Block.MASTER_BRANCH, 'tests', miner)
    smartContract.initialise()

    const keys = await HashTools.generateRsaKeyPair()

    const nameRegistryContractUuid = "name-registry-1"

    smartContract.publishContract(keys.privateKey, nameRegistryContractUuid, 'NameRegistry contract v1 (beta)', 'A DNS-like registry (very dumb)', `
        {
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
        }`
    )

    setInterval(() => smartContract.callContract(nameRegistryContractUuid, 0, 'register', { name: "toto", "ip": "192.168.0.2" }), 1000)
}

main()