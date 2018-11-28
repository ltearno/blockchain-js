import {
    FullNode,
    NodeNetworkClient,
    NetworkApiNodeImpl
} from 'blockchain-js-core'

let peer = {
    address: 'blockchain-js.com',
    port: 443,
    secure: true
}

if (process.argv.length > 2)
    peer.address = process.argv[2]
if (process.argv.length > 3)
    peer.port = parseInt(process.argv[3])
if (process.argv.length > 4)
    peer.secure = process.argv[4] == 'secure'

async function run() {
    const NETWORK_CLIENT_API = new NetworkApiNodeImpl.NetworkApiNodeImpl()

    let fullNode = new FullNode.FullNode()

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

        console.log(`node connected and linked`)
    }
    catch (error) {
        console.log(`error connecting to peer ${JSON.stringify(peer)}`)
    }
}

for (let i = 0; i < 30; i++) {
    run()
}

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
