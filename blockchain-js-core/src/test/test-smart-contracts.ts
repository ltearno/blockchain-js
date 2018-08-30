import * as Block from '../block'
import * as NodeImpl from '../node-impl'
import * as MinerImpl from '../miner-impl'
import * as SmartContract from '../smart-contract'
import * as TestTools from '../test-tools'
import * as HashTools from '../hash-tools'

async function main() {
    let node = new NodeImpl.NodeImpl()
    let miner = new MinerImpl.MinerImpl(node)

    let smartContract = new SmartContract.SmartContract(node, Block.MASTER_BRANCH, miner)
    smartContract.initialise()

    const keys = HashTools.generateRsaKeyPair()
    const nameRegistryContractUuid = "test-me-I-am-a-contract-512"
    const counterContractUuid = "counter-contract-101-for-me"

    smartContract.publishContract(keys.privateKey, counterContractUuid, 'Counter contract v1 (beta)', 'A very simple counter', `
        {
            init: function() {
                this.data.counter = 0
            },

            inc: function(args) {
                if(args && args.error)
                    throw 'you wanted an error isnt it ?'

                let inc = (args && args.inc) || 1

                this.data.counter += inc

                console.log("counter increment by " + inc + ", new value = " + this.data.counter)
            }
        }`
    )

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

                console.log('current counter : ' + stateOfContract('${counterContractUuid}').counter)
                callContract('${counterContractUuid}', 0, 'inc', {inc:5})
                console.log('after call counter : ' + stateOfContract('${counterContractUuid}').counter)

                console.log('registered name ' + args.name + ' to ' + args.ip + ' while counter contract state is ' + JSON.stringify(stateOfContract('${counterContractUuid}')))
            }
        }`
    )

    smartContract.callContract(counterContractUuid, 0, 'test')
    smartContract.callContract(counterContractUuid, 0, 'inc', { inc: 4 })
    smartContract.callContract(counterContractUuid, 0, 'inc')
    smartContract.callContract(counterContractUuid, 0, 'inc', { error: true })

    let n = 0
    while (true) {
        await miner.mineData()
        smartContract.callContract(nameRegistryContractUuid, 0, 'register', { name: `name-${n}`, ip: `192.168.0.${n}` })
        smartContract.callContract(nameRegistryContractUuid, 0, 'register', { name: `name-${n}`, ip: `192.168.0.${n + 1}` })
        smartContract.callContract(counterContractUuid, 0, 'inc')
        smartContract.callContract(nameRegistryContractUuid, 0, 'register', { name: `name-${n}`, ip: `192.168.0.${n + 2}` })

        await TestTools.wait(1000)

        n++
    }
}

main()