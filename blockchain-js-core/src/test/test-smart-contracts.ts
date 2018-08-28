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

    smartContract.tryCreateContract(0, keys.privateKey, 'mon premier contract', 'ceci est très basique !', `
        { 
            test: function() {
                if(!this.value)
                    this.value=0;
                
                this.value++;
                console.log("hello from contract");
            } 
        }`)
    smartContract.callContract(0, 'test', {})

    while (true) {
        await miner.mineData()
        smartContract.callContract(0, 'test', {})
        await TestTools.wait(2000)

        smartContract.displayStatus()
    }
}

main()