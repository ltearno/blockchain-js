import * as fs from 'fs'
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
    const badKeys = await HashTools.generateRsaKeyPair()

    const identityRegistryContractUuid = "identity-registry-1"

    let scriptContent = fs.readFileSync('identity-registry.sm.js', { encoding: 'utf8' })

    smartContract.publishContract(keys.privateKey, identityRegistryContractUuid, 'IdentityRegistry contract v1', 'A simple identity provider', scriptContent)

    smartContract.callContract(identityRegistryContractUuid, 0, 'registerIdentity', {
        email: `ltearno@blockchain-js.com`,
        comment: `I am a randomly generated identity at time ${new Date().toISOString()}`,
        publicKey: keys.publicKey
    })

    console.log(`waiting mining contract and register identity`)
    setTimeout(() => {
        setInterval(async () => {
            smartContract.callContract(identityRegistryContractUuid, 0, 'registerIdentity', {
                email: `${(await HashTools.hashString('' + Math.random())).substr(0, 4)}@blockchain-js.com`,
                comment: `I am a randomly generated identity at time ${new Date().toISOString()}`,
                publicKey: keys.publicKey
            })

            let signedIn = await smartContract.simulateCallContract(identityRegistryContractUuid, 0, 'signIn', {
                signedEmail: JSON.stringify(HashTools.signAndPackData('ltearno@blockchain-js.com', keys.privateKey))
            })

            console.log(`signedIn from app : ${signedIn}`)

            await smartContract.simulateCallContract(identityRegistryContractUuid, 0, 'signIn', {
                signedEmail: JSON.stringify(HashTools.signAndPackData('ltearno2@blockchain-js.com', keys.privateKey))
            })

            console.log(`signedIn from app : ${signedIn}`)

            signedIn = await smartContract.simulateCallContract(identityRegistryContractUuid, 0, 'signIn', {
                signedEmail: JSON.stringify(HashTools.signAndPackData('ltearno@blockchain-js.com', badKeys.privateKey))
            })

            console.log(`signedIn from app : ${signedIn}`)
        }, 1000)
    }, 2000)
}

main()