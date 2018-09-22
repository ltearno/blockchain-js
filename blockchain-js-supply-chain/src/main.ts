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
    const supplyChainRegistryContractUuid = "supply-chain-v1"

    smartContract.publishContract(
        keys.privateKey,
        identityRegistryContractUuid,
        'IdentityRegistry contract v1',
        'A simple identity provider',
        fs.readFileSync('identity-registry.sm.js', { encoding: 'utf8' })
    )

    smartContract.publishContract(
        keys.privateKey,
        supplyChainRegistryContractUuid,
        'SupplyChain contract v1',
        'A simple supply chain marketplace smart contract',
        fs.readFileSync('supply-chain.sm.js', { encoding: 'utf8' })
    )

    await smartContract.callContract(identityRegistryContractUuid, 0, 'registerIdentity', {
        email: `ltearno@blockchain-js.com`,
        comment: `I am a randomly generated identity at time ${new Date().toISOString()}`,
        publicKey: keys.publicKey
    })

    await waitUntil(async () => {
        return (await smartContract.simulateCallContract(identityRegistryContractUuid, 0, 'signIn', {
            data: HashTools.signAndPackData({ email: 'ltearno@blockchain-js.com' }, keys.privateKey)
        })) != null
    })

    console.log(`signedIn on blockchain !`)

    let createAccountCallId = await smartContract.callContract(supplyChainRegistryContractUuid, 0, 'createAccount', { data: HashTools.signAndPackData({ email: 'ltearno@blockchain-js.com' }, keys.privateKey) })

    await waitUntil(() => smartContract.hasReturnValue(createAccountCallId))

    let account = smartContract.getReturnValue(createAccountCallId)
    if (!account) {
        console.log(`account cannot be created`)
        return
    }
    console.log(`account : ${JSON.stringify(account)}`)

    // todo : create two accounts

    // check accounts

    // publish an ask

    // list asks

    // publish a bid

    // list bids

    // select bid

    // check accounts
}

main()

async function waitUntil(condition: () => Promise<boolean>) {
    while (!await condition())
        await wait(500)
}

function wait(duration: number) {
    return new Promise((resolve, reject) => {
        setTimeout(() => resolve(), duration)
    })
}