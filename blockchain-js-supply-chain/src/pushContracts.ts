import * as fs from 'fs'
import {
    Block,
    FullNode,
    HashTools,
    SmartContract,
    NodeNetworkClient,
    NetworkApiNodeImpl,
    SequenceStorage
} from 'blockchain-js-core'

(process as any).env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0

async function run() {
    const NETWORK_CLIENT_API = new NetworkApiNodeImpl.NetworkApiNodeImpl()

    let fullNode = new FullNode.FullNode()

    let peer = {
        address: 'blockchain-js.com',
        port: 443,
        secure: true
    }

    function uuidv4() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8)
            return v.toString(16)
        })
    }

    let branch = uuidv4()

    if (process.argv.length > 2)
        peer.address = process.argv[2]
    if (process.argv.length > 3)
        peer.port = parseInt(process.argv[3])
    if (process.argv.length > 4)
        peer.secure = process.argv[4] == 'secure'
    if (process.argv.length > 5)
        branch = process.argv[5]

    console.log(`pushing contracts to ${peer.address}:${peer.port} on branch ${branch}`)

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

        console.log(`connecting to remote peer...`)
        peerInfo.fullNodePeerInfo = fullNode.addPeer(peerNode.remoteFacade(), `peer added through REST: ${peer.address}:${peer.port}`)
        await wait(1000)

        console.log(`init supplyChainBranchSequence...`)
        let supplyChainBranchSequence = new SequenceStorage.SequenceStorage(
            fullNode.node,
            Block.MASTER_BRANCH,
            `supply-chain-branch-sequence`,
            fullNode.miner)
        supplyChainBranchSequence.initialise()
        await wait(1000)

        console.log(`registering smart contract...`)
        supplyChainBranchSequence.addItems([branch])

        let smartContract = new SmartContract.SmartContract(fullNode.node, branch, 'people', fullNode.miner)
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

        console.log(`finished`)
    }
    catch (error) {
        console.log(`error connecting to peer ${JSON.stringify(peer)}`)
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
