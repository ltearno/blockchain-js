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


const PROFILE = false

async function main() {
    if (PROFILE) {
        const profiler = require('v8-profiler')
        const profileId = `${Date.now()}.profile`
        profiler.startProfiling(profileId)
        setTimeout(() => {
            const profile = JSON.stringify(profiler.stopProfiling(profileId))
            fs.writeFile(profileId, profile, () => {
                console.log(`profiling done to ${profileId}`)
                process.exit()
            })
        }, 45000)
    }

    let node = new NodeImpl.NodeImpl()
    let miner = new MinerImpl.MinerImpl(node)

    let smartContract = new SmartContract.SmartContract(node, Block.MASTER_BRANCH, 'tests', miner)
    smartContract.initialise()

    let callContract = async (contractUuid, iterationId, method, account, data) => {
        data.id = account.id
        let callId = await smartContract.callContract(contractUuid, iterationId, method, account ? HashTools.signAndPackData(data, account.keys.privateKey) : data)
        return await waitReturn(smartContract, callId)
    }

    let contractCreatorAccount = {
        keys: await HashTools.generateRsaKeyPair(),
        id: 'god@blockchain-js.com'
    }

    const identityRegistryContractUuid = "identity-registry-1"
    const supplyChainRegistryContractUuid = "supply-chain-v1"
    const randomContractUuid = "random-generator-v1"

    smartContract.publishContract(
        contractCreatorAccount.keys.privateKey,
        identityRegistryContractUuid,
        'IdentityRegistry contract v1',
        'A simple identity provider',
        fs.readFileSync('identity-registry.sm.js', { encoding: 'utf8' })
    )

    smartContract.publishContract(
        contractCreatorAccount.keys.privateKey,
        randomContractUuid,
        'RandomGenerator contract v1',
        'A simple random generator smart contract',
        fs.readFileSync('random-generator.sm.js', { encoding: 'utf8' })
    )

    smartContract.publishContract(
        contractCreatorAccount.keys.privateKey,
        supplyChainRegistryContractUuid,
        'SupplyChain contract v1',
        'A simple gamified supply chain marketplace smart contract',
        fs.readFileSync('supply-chain.sm.js', { encoding: 'utf8' })
    )

    let supplyChainCall = async (method, account, data) => callContract(supplyChainRegistryContractUuid, 0, method, account, data)



    async function registerIdentity(account) {
        if (! await callContract(identityRegistryContractUuid, 0, 'registerIdentity', account, {
            pseudo: `I am a randomly generated identity at time ${new Date().toISOString()}`
        })) {
            console.log(`failed to register identity`)
            return null
        }

        console.log(`identity registered with id ${account.id}`)

        let identity = await supplyChainCall('createAccount', account, {})
        if (!identity) {
            console.log(`account cannot be created`)
            return null
        }

        console.log(`created account : ${account.id}`)

        return identity
    }

    // register two accounts

    let account1 = {
        keys: await HashTools.generateRsaKeyPair(),
        id: 'ltearno@blockchain-js.com'
    }
    await registerIdentity(account1)

    let account2 = {
        keys: await HashTools.generateRsaKeyPair(),
        id: 'isaia@blockchain-js.com'
    }
    await registerIdentity(account2)

    let flow = (obj) => Object.getOwnPropertyNames(obj).map(key => [key, obj[key]])

    function shuffle(a) {
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    async function printSummary() {
        let supplyChainState = await smartContract.simulateCallContract(supplyChainRegistryContractUuid, 0, 'getState')

        let nbClosedAsks = 0
        let nbOpenAsks = 0

        for (let askId in supplyChainState.asks) {
            let ask = supplyChainState.asks[askId]
            if (ask.asks.every(askItem => askItem.bidId != null))
                nbClosedAsks++
            else
                nbOpenAsks++
        }

        let nbSelectedBids = 0
        let nbUnselectedBids = 0

        for (let bidId in supplyChainState.bids) {
            let bid = supplyChainState.bids[bidId]
            if (bid.selected)
                nbSelectedBids++
            else
                nbUnselectedBids++
        }

        console.log(`Users\n${JSON.stringify(supplyChainState.users, null, 2)}`)
        console.log(`Asks: ${Object.getOwnPropertyNames(supplyChainState.asks).length}, opened : ${nbOpenAsks}, closed : ${nbClosedAsks}`)
        console.log(`Bids: ${Object.getOwnPropertyNames(supplyChainState.bids).length}, unsel : ${nbUnselectedBids}, sel : ${nbSelectedBids}`)
    }

    async function bot() {
        let botAccount = {
            keys: await HashTools.generateRsaKeyPair(),
            id: `bot-${(await HashTools.hashString('' + Math.random())).substr(0, 5)}@blockchain-js.com`
        }

        if (!await registerIdentity(botAccount)) {
            console.error(`failed to register bot identity`)
            return
        }

        // publish an ask
        await supplyChainCall('publishAsk', botAccount, {
            id: await HashTools.hashString(Math.random() + ''),
            title: `Something`,
            description: `Something`,
            asks: [
                {
                    description: `first`
                },
                {
                    description: `second`
                }
            ]
        })

        let sendBidsFor = new Set<string>()

        let countValidations = 0

        while (true) {
            await wait(10)

            let supplyChainState = await smartContract.simulateCallContract(supplyChainRegistryContractUuid, 0, 'getState')

            if (countValidations >= 2) {
                countValidations = 0

                // publish an ask
                await supplyChainCall('publishAsk', botAccount, {
                    id: await HashTools.hashString(Math.random() + ''),
                    title: `Something`,
                    description: `Something`,
                    asks: [
                        {
                            description: `first`
                        },
                        {
                            description: `second`
                        }
                    ]
                })

                continue
            }

            // what can we offer ?
            let maybe = []
            for (let itemId in supplyChainState.users[botAccount.id].items) {
                if (supplyChainState.users[botAccount.id].items[itemId] > 0) {
                    maybe.push(itemId)
                }
            }
            if (maybe.length) {
                let itemIdToOffer = maybe[Math.ceil(Math.random() * maybe.length)]

                let somethingSent = false

                // to whom ?
                for (let [askId, ask] of shuffle(flow(supplyChainState.asks))) {
                    if (ask.id == botAccount.id)
                        continue

                    let askIndex = ask.asks.findIndex(askItem => !askItem.bidId)
                    if (askIndex >= 0 && !sendBidsFor.has(`${askId}--${askIndex}`)) {
                        sendBidsFor.add(`${askId}--${askIndex}`)
                        // publish a bid
                        if (! await supplyChainCall('publishBid', botAccount, {
                            id: await HashTools.hashString(Math.random() + ''),
                            askId,
                            askIndex,
                            itemId: itemIdToOffer,
                            title: `...`,
                            price: 1,
                            description: `...`,
                            specification: ``
                        })) {
                            console.error(`cannot publish bid!`)
                        }

                        //countValidations++

                        somethingSent = true
                        break
                    }
                }

                if (somethingSent)
                    continue
            }

            // valider les propositions reçues
            for (let [bidId, bid] of flow(supplyChainState.bids)) {
                let ask = supplyChainState.asks[bid.askId]
                if (ask.id !== botAccount.id)
                    continue

                if (ask.asks[bid.askIndex].bidId)
                    continue

                if (! await supplyChainCall('selectBid', botAccount, { bidId: bidId })) {
                    console.error(`cannot select bid !`)
                }

                countValidations++

                break
            }

            await miner.mineData()
        }
    }

    setInterval(async () => await printSummary(), 5000)

    bot()
    bot()
    bot()
    bot()
    bot()

    // publish an ask
    let askId = await HashTools.hashString(Math.random() + '')
    if (!await supplyChainCall('publishAsk', account1, {
        id: askId,
        title: `Un vélo`,
        description: `On désire mener la conception de la supply chain d'un nouveau genre de vélo ensemble`,
        asks: [
            {
                description: `roue`
            },
            {
                description: `pédale`
            }
        ]
    })) {
        console.error(`cannot publish ask !`)
        return
    }

    // publish a bid
    let bid1Id = await HashTools.hashString(Math.random() + '')
    if (! await supplyChainCall('publishBid', account2, {
        id: bid1Id,
        askId,
        askIndex: 0,
        itemId: 'roue', // we known we have it, because of the HACK !!!
        title: `Roue lumineuse`,
        price: 1.3,
        description: `Une roue qui s'allume sans pile`,
        specification: `background-color:red;`
    })) {
        console.error(`cannot publish bid 1 !`)
        return
    }

    // publish another bid
    let bid2Id = await HashTools.hashString(Math.random() + '')
    if (! await supplyChainCall('publishBid', account2, {
        id: bid2Id,
        askId,
        askIndex: 1,
        itemId: 'roue', // we known we have it, because of the HACK !!!
        title: `Roue ferme`,
        price: 1.2,
        description: `Une roue classique`,
        specification: `background-color:blue;`
    })) {
        console.error(`cannot publish bid 2 !`)
        return
    }

    // select bid 1
    if (! await supplyChainCall('selectBid', account1, { bidId: bid1Id })) {
        console.error(`cannot select bid 1 !`)
        return
    }

    // select bid 2
    if (! await supplyChainCall('selectBid', account1, { bidId: bid2Id })) {
        console.error(`cannot select bid 2 !`)
        return
    }
}

main()

async function waitReturn(smartContract, callId) {
    await waitUntil(() => smartContract.hasReturnValue(callId))
    return smartContract.getReturnValue(callId)
}

async function waitUntil(condition: () => Promise<boolean>) {
    while (!await condition())
        await wait(50)
}

function wait(duration: number) {
    return new Promise((resolve, reject) => {
        setTimeout(() => resolve(), duration)
    })
}

/**
 * TODO : scaled testing
 * 
 * 
 * en standard quand on fait un call à un smart contract :
 *  
 * - on regarde le block-head actuel
 * - on envoie la data à miner
 * - on attend soit d'avoir un résultat, soit que le block témoin soit hors-chaine ou au moins X blocks en bas
 * 
 * => et on refait le call tant que cela ne marche pas
 * 
 * => TODO : quand on fait un call, on dit un block référence et une longueur max de chaine : le call ne se fait que si la data correspondante est dans cet interval
 * 
 * tester avoir :
 * 
 * - plein de petits noeuds (pour simuler les téléphones des gens)
 * - connectés par la mise en relation (rencontres)
 * - des bots qui font des choses au hasard :
 *      - **considérant un prix constant par item**
 *      - s'ouvrir un compte
 *      - en boucle :
 *          - regarder s'il y a des demandes à pourvoir auxquelles on n'a pas répondu, proposer au hasard dans les items possédés
 *          - si on a assez de sous (?), emettre une demande
 *          - valider les propositions reçues si necessaire
 */