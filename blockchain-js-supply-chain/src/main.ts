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

    let account1 = {
        keys: await HashTools.generateRsaKeyPair(),
        email: 'ltearno@blockchain-js.com'
    }

    let account2 = {
        keys: await HashTools.generateRsaKeyPair(),
        email: 'isaia@blockchain-js.com'
    }

    const identityRegistryContractUuid = "identity-registry-1"
    const supplyChainRegistryContractUuid = "supply-chain-v1"
    const randomContractUuid = "random-generator-v1"

    smartContract.publishContract(
        account1.keys.privateKey,
        identityRegistryContractUuid,
        'IdentityRegistry contract v1',
        'A simple identity provider',
        fs.readFileSync('identity-registry.sm.js', { encoding: 'utf8' })
    )

    smartContract.publishContract(
        account2.keys.privateKey,
        randomContractUuid,
        'RandomGenerator contract v1',
        'A simple random generator smart contract',
        fs.readFileSync('random-generator.sm.js', { encoding: 'utf8' })
    )

    smartContract.publishContract(
        account1.keys.privateKey,
        supplyChainRegistryContractUuid,
        'SupplyChain contract v1',
        'A simple gamified supply chain marketplace smart contract',
        fs.readFileSync('supply-chain.sm.js', { encoding: 'utf8' })
    )

    async function registerIdentity(account) {
        await smartContract.callContract(identityRegistryContractUuid, 0, 'registerIdentity', {
            email: account.email,
            comment: `I am a randomly generated identity at time ${new Date().toISOString()}`,
            publicKey: account.keys.publicKey
        })

        await waitUntil(async () => {
            return (await smartContract.simulateCallContract(identityRegistryContractUuid, 0, 'signIn', HashTools.signAndPackData({ email: account.email }, account.keys.privateKey))) != null
        })

        console.log(`identity registered with email ${account.email}`)


        let createAccountCallId = await smartContract.callContract(supplyChainRegistryContractUuid, 0, 'createAccount', HashTools.signAndPackData({ email: account.email }, account.keys.privateKey))
        await waitUntil(() => smartContract.hasReturnValue(createAccountCallId))
        if (!smartContract.getReturnValue(createAccountCallId)) {
            console.log(`account cannot be created`)
            return
        }

        console.log(`waiting for account...`)
        await waitUntil(async () => {
            return (await smartContract.simulateCallContract(supplyChainRegistryContractUuid, 0, 'hasAccount', {
                email: account.email
            })) == true
        })

        console.log(`account : ${JSON.stringify(account)}`)
    }

    await registerIdentity(account1)
    await registerIdentity(account2)

    // todo : create two accounts

    // publish an ask
    let askId = await HashTools.hashString(Math.random() + '')
    let publishAskCallId = await smartContract.callContract(supplyChainRegistryContractUuid, 0, 'publishAsk', HashTools.signAndPackData({
        email: account1.email,
        id: askId,
        title: `Fabrication d'un vélo`,
        description: `Il faut faire un vélo ensemble`,
        asks: [
            {
                description: `roue`
            },
            {
                description: `pédale`
            }
        ]
    }, account1.keys.privateKey))

    if (! await waitReturn(smartContract, publishAskCallId)) {
        console.error(`cannot publish ask !`)
        return
    }

    // publish a bid
    let bidId = await HashTools.hashString(Math.random() + '')
    let publishBidCallId = await smartContract.callContract(supplyChainRegistryContractUuid, 0, 'publishBid', HashTools.signAndPackData({
        email: account2.email,
        id: bidId,
        askId,
        askIndex: 0,
        title: `Roue lumineuse`,
        price: 1.3,
        description: `Une roue qui s'allume sans pile`,
        specification: `background-color:red;`
    }, account2.keys.privateKey))
    if (! await waitReturn(smartContract, publishBidCallId)) {
        console.error(`cannot publish bid !`)
        return
    }

    // select bid
    let selectBidCallId = await smartContract.callContract(supplyChainRegistryContractUuid, 0, 'selectBid', HashTools.signAndPackData({
        email: account1.email,
        bidId
    }, account1.keys.privateKey))
    if (! await waitReturn(smartContract, selectBidCallId)) {
        console.error(`cannot publish bid !`)
        return
    }

    // check accounts
    let supplyChainState = await smartContract.simulateCallContract(supplyChainRegistryContractUuid, 0, 'getState')
    console.log(`Asks\n${JSON.stringify(supplyChainState.asks, null, 2)}`)
    console.log(`Bids\n${JSON.stringify(supplyChainState.bids, null, 2)}`)
    console.log(`Users\n${JSON.stringify(supplyChainState.users, null, 2)}`)
}

main()

async function waitReturn(smartContract, callId) {
    await waitUntil(() => smartContract.hasReturnValue(callId))
    return smartContract.getReturnValue(callId)
}

async function waitUntil(condition: () => Promise<boolean>) {
    while (!await condition())
        await wait(500)
}

function wait(duration: number) {
    return new Promise((resolve, reject) => {
        setTimeout(() => resolve(), duration)
    })
}