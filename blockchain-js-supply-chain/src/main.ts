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

    const nameRegistryContractUuid = "name-registry-1"

    let scriptContent = fs.readFileSync('name-registry.sm.js', { encoding: 'utf8' })
    if (!scriptContent.startsWith("return")) {
        console.error(`script should begin with "return ..."`)
        return
    }

    scriptContent = scriptContent.substr("return".length)

    smartContract.publishContract(keys.privateKey, nameRegistryContractUuid, 'NameRegistry contract v1 (beta)', 'A DNS-like registry (very dumb)', scriptContent)

    setInterval(async () => smartContract.callContract(nameRegistryContractUuid, 0, 'register', { name: `toto.${await HashTools.hashString('' + Math.random())}`, "ip": await HashTools.hashString('' + Math.random()) }), 5)
}

main()