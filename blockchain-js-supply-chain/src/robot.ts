import * as fs from 'fs'
import {
    Block,
    FullNode,
    HashTools,
    SmartContract,
    NodeNetworkClient,
    NetworkApiNodeImpl
} from 'blockchain-js-core'

async function run() {
    const NETWORK_CLIENT_API = new NetworkApiNodeImpl.NetworkApiNodeImpl()

    let fullNode = new FullNode.FullNode()

    let peer = {
        address: 'blockchain-js.com',
        port: 443,
        secure: true
    }

    peer = {
        address: 'localhost',
        port: 9091,
        secure: false
    }

    if (process.argv.length > 2)
        peer.address = process.argv[2]
    if (process.argv.length > 3)
        peer.port = parseInt(process.argv[3])
    if (process.argv.length > 4)
        peer.secure = process.argv[4] == 'secure'

    console.log(`pushing actions to ${peer.address}:${peer.port}`)

    let peerInfo = {
        peer,
        fullNodePeerInfo: null
    }

    let peerNode = new NodeNetworkClient.NodeClient(fullNode.node, peer.address, peer.port, peer.secure, () => {
        if (peerInfo.fullNodePeerInfo && peerInfo.fullNodePeerInfo.id)
            fullNode.removePeer(peerInfo.fullNodePeerInfo.id)
    }, NETWORK_CLIENT_API)

    try {
        await peerNode.initialize()

        peerInfo.fullNodePeerInfo = fullNode.addPeer(peerNode.remoteFacade(), `peer added through REST: ${peer.address}:${peer.port}`)

        let smartContract = new SmartContract.SmartContract(fullNode.node, Block.MASTER_BRANCH, 'people', fullNode.miner)
        smartContract.initialise()

        const identityRegistryContractUuid = "identity-registry-1"
        const supplyChainRegistryContractUuid = "supply-chain-v1"
        const randomContractUuid = "random-generator-v1"

        let user = {
            id: `rob${Math.random()}`,
            keys: await HashTools.generateRsaKeyPair()
        }

        console.log(`user: ${JSON.stringify(user, null, 4)}`)

        let callContract = async (contractUuid, iterationId, method, account, data) => {
            if (account)
                data.id = account.id
            let callId = await smartContract.callContract(contractUuid, iterationId, method, account ? HashTools.signAndPackData(data, account.keys.privateKey) : data)
            return await waitReturn(smartContract, callId)
        }

        let userAccount = null

        let artWorkId = null

        let supplyChainState = null

        let state = 0
        while (state >= 0) {
            await wait(250)

            console.log(`state ${state}`)

            switch (state) {
                case 0: {
                    if (smartContract.hasContract(identityRegistryContractUuid) && smartContract.hasContract(supplyChainRegistryContractUuid) && smartContract.hasContract(randomContractUuid)) {
                        console.log(`having all contracts`)
                        state = 1
                    }
                    break
                }

                case 1: {
                    let identityContractState = smartContract.getContractState(identityRegistryContractUuid)
                    if (!identityContractState) {
                        console.log(`no identity contract state`)
                        state = 0
                        break
                    }

                    if (identityContractState.identities[user.id]) {
                        console.log(`identity already registered (${user.id})`)
                        state = 2
                    }

                    if (! await callContract(identityRegistryContractUuid, 0, 'registerIdentity', user, {})) {
                        console.log(`failed to register identity`)
                        state = 0
                    }

                    console.log(`identity registered with id ${user.id}`)
                    state = 2
                    break
                }

                case 2: {
                    supplyChainState = smartContract.getContractState(supplyChainRegistryContractUuid)

                    if (!supplyChainState.accounts[user.id]) {
                        console.log(`registering account on supply chain...`)
                        await callContract(supplyChainRegistryContractUuid, 0, 'createAccount', user, {})
                    }
                    else {
                        console.log(`already registered on supplychain`)
                    }

                    supplyChainState = smartContract.getContractState(supplyChainRegistryContractUuid)
                    userAccount = supplyChainState.accounts[user.id]

                    console.log(`account ${JSON.stringify(userAccount, null, 4)}`)

                    state = 3
                    break
                }

                case 3: {
                    supplyChainState = smartContract.getContractState(supplyChainRegistryContractUuid)
                    userAccount = supplyChainState.accounts[user.id]

                    console.log(`account ${JSON.stringify(userAccount, null, 4)}`)
                    console.log(`user ${JSON.stringify(user, null, 4)}`)

                    let count = 0
                    Object.keys(userAccount.inventory).forEach(id => count += userAccount.inventory[id])
                    if (count <= 0) {
                        console.log(`no more items, bye bye`)
                        state = -1
                        break
                    }

                    artWorkId = `rr${Math.random()}`

                    await callContract(supplyChainRegistryContractUuid, 0, 'registerArtWork', null, {
                        artWork: {
                            id: artWorkId,
                            size: { width: 7, height: 7 },
                            author: user.id
                        }
                    })

                    supplyChainState = smartContract.getContractState(supplyChainRegistryContractUuid)
                    userAccount = supplyChainState.accounts[user.id]

                    console.log(`artwork created`)

                    state = 4
                }

                case 4: {
                    let count = 0

                    let x = 0
                    let y = 0
                    Object.keys(userAccount.inventory).forEach(itemId => {
                        if (!userAccount.inventory[itemId])
                            return

                        if (count++ > 2)
                            return

                        console.log(`add item ${itemId} at ${x};${y}`)

                        callContract(supplyChainRegistryContractUuid, 0, 'addItemInArtWorkFromInventory', null, {
                            artWorkId, itemId, x, y
                        })
                        x++
                        if (x > 5) {
                            x = 0
                            y++
                        }
                    })

                    count = 10
                    if (Object.keys(supplyChainState.artWorks).length > 3) {
                        while (count-- >= 0) {
                            let awid: any = Object.keys(supplyChainState.artWorks)
                            awid = awid[Math.floor(Math.random() * awid.length)]

                            if (!supplyChainState.artWorks[awid].validated)
                                continue

                            let itemId = `artwork-${awid}`
                            console.log(`add artwork ${itemId} at ${x};${y}`)

                            callContract(supplyChainRegistryContractUuid, 0, 'addItemInArtWorkFromInventory', null, {
                                artWorkId, itemId, x, y
                            })

                            x++
                            if (x > 5) {
                                x = 0
                                y++
                            }
                        }
                    }

                    await callContract(supplyChainRegistryContractUuid, 0, 'validateArtWork', null, { artWorkId })

                    state = 3

                    break
                }

                default:
                    state = -1
                    break
            }
        }
    }
    catch (error) {
        console.log(`error connecting to peer ${JSON.stringify(peer)}, ${error}`, error)
    }
}

run()


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
