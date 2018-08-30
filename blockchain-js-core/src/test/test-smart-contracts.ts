import * as Block from '../block'
import * as NodeImpl from '../node-impl'
import * as MinerImpl from '../miner-impl'
import * as SmartContract from '../smart-contract'
import * as TestTools from '../test-tools'
import * as HashTools from '../hash-tools'

async function main() {
    let node = new NodeImpl.NodeImpl()
    let miner = new MinerImpl.MinerImpl(node)

    const contractUuid = "test-me-I-am-a-contract-512"

    let smartContract = new SmartContract.SmartContract(node, Block.MASTER_BRANCH, contractUuid, miner)
    smartContract.initialise()

    console.log(`real beginning`)

    let keys = HashTools.generateRsaKeyPair()

    smartContract.tryCreateContract(keys.privateKey, 'mon premier contract', 'ceci est très basique !', `
        { 
            test: function() {
                if(!this.value)
                    this.value=0;
                
                this.value++;
                console.log("hello from contract");
            },

            register: function(args) {
                if(!this.registre)
                    this.registre = {}
                
                if(args.name in this.registre){
                    console.warn('already registered name ' + args.name)
                    return
                }
                
                this.registre[args.name] = args.ip

                console.log('registered name ' + args.name + ' to ' + args.ip)
            }
        }`)
    smartContract.callContract(0, 'test', {})

    let n = 0
    while (true) {
        await miner.mineData()
        smartContract.callContract(0, 'test', {})
        smartContract.callContract(0, 'register', { name: `name-${n}`, ip: `192.168.0.${n}` })
        smartContract.callContract(0, 'register', { name: `name-${n}`, ip: `192.168.0.${n + 1}` })
        smartContract.callContract(0, 'register', { name: `name-${n}`, ip: `192.168.0.${n + 2}` })

        await TestTools.wait(1000)
        smartContract.displayStatus()

        n++
    }
}

main()