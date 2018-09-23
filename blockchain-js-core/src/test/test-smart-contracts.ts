import * as Block from '../block'
import * as NodeImpl from '../node-impl'
import * as MinerImpl from '../miner-impl'
import * as SmartContract from '../smart-contract'
import * as TestTools from '../test-tools'
import * as HashTools from '../hash-tools'

async function main() {
    let node = new NodeImpl.NodeImpl()
    let miner = new MinerImpl.MinerImpl(node)

    let smartContract = new SmartContract.SmartContract(node, Block.MASTER_BRANCH, 'tests', miner)
    smartContract.initialise()

    const keys = await HashTools.generateRsaKeyPair()
    const nameRegistryContractUuid = "test-me-I-am-a-contract-512"
    const counterContractUuid = "counter-contract-101-for-me"
    const fibonacciContractUuid = "fibo-contract"

    smartContract.publishContract(keys.privateKey, counterContractUuid, 'Counter contract v1 (beta)', 'A very simple counter', `
        {
            init: function() {
                this.data.counter = 0
            },

            inc: function(args) {
                // introspection demo
                console.log('i am a contract and i can know my :')
                console.log('uuid : ' + this.uuid)
                console.log('name : ' + this.name)
                console.log('description : ' + this.description)
                console.log('currentIterationId : ' + this.currentIterationId)
                console.log('publicKey : ' + this.publicKey.substr(0,10))

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
                    return false
                }
                
                this.data.registre[args.name] = args.ip

                //console.log('current counter : ' + stateOfContract('${counterContractUuid}').counter)
                //callContract('${counterContractUuid}', 0, 'inc', {inc:5})
                //console.log('after call counter : ' + stateOfContract('${counterContractUuid}').counter)

                console.log('registered name ' + args.name + ' to ' + args.ip + ' while counter contract state is ' + JSON.stringify(stateOfContract('${counterContractUuid}')))

                return true
            }
        }`
    )

    smartContract.publishContract(keys.privateKey, fibonacciContractUuid, 'Fibonacci contract v1 (beta)', 'A recursive contract calling another one !', `
        {
            fibonacci: function(args) {
                let value = (args&&args.n) || 0

                console.log('fibonacci of '+value)

                if(value==0||value==1)
                    return value
                
                // we can do that, it works !
                // callContract('${counterContractUuid}', 0, 'inc', {inc:42})

                let v1 = callContract(this.uuid, 0, 'fibonacci', {n:value-1})
                let v2 = callContract(this.uuid, 0, 'fibonacci', {n:value-2})
                
                let result = v1 + v2

                console.log('fib(' + value + ') = ' + result + ' ' + v1 + ' ' + v2)

                return result
            }
        }`
    )

    //await smartContract.callContract(counterContractUuid, 0, 'test')
    //await smartContract.callContract(counterContractUuid, 0, 'inc', { inc: 4 })
    //await smartContract.callContract(counterContractUuid, 0, 'inc')
    //await smartContract.callContract(counterContractUuid, 0, 'inc', { error: true })

    let callIds = new Set<string>()

    let n = 0
    while (true) {
        let callId = await smartContract.callContract(nameRegistryContractUuid, 0, 'register', { name: `name-${n}`, ip: `192.168.0.${n}` })
        callIds.add(callId)
        console.log(`calledId ${callId}`)
        //await smartContract.callContract(nameRegistryContractUuid, 0, 'register', { name: `name-${n}`, ip: `192.168.0.${n + 1}` })
        //await smartContract.callContract(counterContractUuid, 0, 'inc')
        //await smartContract.callContract(nameRegistryContractUuid, 0, 'register', { name: `name-${n}`, ip: `192.168.0.${n + 2}` })

        //await miner.mineData(10)
        console.log(`\n\n\nbreathing...\n\n\n`)
        await TestTools.wait(2000)

        //for (let j = 0; j < 10; j++)
        //    await smartContract.simulateCallContract(nameRegistryContractUuid, 0, 'register', { name: `name-${n}`, ip: `192.168.0.${n + 2}` })

        n++

        for (let callId of callIds) {

            if (smartContract.hasReturnValue(callId)) {
                console.log(`CALL RETURN VALUE ${callId} :  ${smartContract.getReturnValue(callId)}`)
                callIds.delete(callId)
            }
        }

        //smartContract.callContract(fibonacciContractUuid, 0, 'fibonacci', { n })
    }
}

main()