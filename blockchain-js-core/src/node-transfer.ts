import * as Block from './block'
import * as NodeApi from './node-api'

/**
 * Interaction between a node and a set of remote nodes
 * 
 * remote nodes can be added with the addRemoteNode function
 * they can be removed with the removeRemoteNode function
 */
export class NodeTransfer {
    private listeners: any[] = undefined
    private knownNodes: NodeApi.NodeApi[] = undefined

    constructor(
        public node: NodeApi.NodeApi
    ) {
    }

    initialize(knownNodes: NodeApi.NodeApi[]) {
        this.listeners = []
        this.knownNodes = []

        knownNodes.forEach(node => this.initRemoteNode(node))
    }

    getKnownNodes() {
        return this.knownNodes
    }

    addRemoteNode(remoteNode: NodeApi.NodeApi) {
        console.log(`addRemoteNode ${remoteNode.name}`)
        this.initRemoteNode(remoteNode)
    }

    removeRemoteNode(remoteNode: NodeApi.NodeApi) {
        let index = this.knownNodes.indexOf(remoteNode)
        if (index < 0)
            return

        console.log(`removeRemoteNode ${remoteNode.name}`)

        remoteNode.removeEventListener(this.listeners[index])
        this.listeners.splice(index, 1)
        this.knownNodes.splice(index, 1)
    }

    terminate() {
        this.knownNodes.forEach((remoteNode, index) => remoteNode.removeEventListener(this.listeners[index]))
        this.listeners = undefined
        this.node = undefined
        this.knownNodes = undefined
    }

    private initRemoteNode(remoteNode: NodeApi.NodeApi) {
        this.knownNodes.push(remoteNode)

        let listener = (branch: string) => {
            console.log(`[${this.node.name}] receive branch ${branch} change from ${remoteNode.name}`)
            try {
                this.fetchFromNode(remoteNode, branch)
            }
            catch (err) {
                console.log(`error when fetchAllBranchesFromNode for node ${remoteNode.name}: ${err}`)
            }
        }

        remoteNode.addEventListener('head', listener)

        this.listeners.push(listener)

        this.fetchAllBranchesFromNode(remoteNode)
    }

    private async fetchAllBranchesFromNode(remoteNode: NodeApi.NodeApi) {
        try {
            let branches = await remoteNode.branches()
            if (!branches) {
                console.log(`empty branch set, nothing to do...`)
                return
            }
            for (let branch of branches) {
                try {
                    await this.fetchFromNode(remoteNode, branch)
                }
                catch (err) {
                    console.log(`error when fetchAllBranchesFromNode for node ${remoteNode.name}: ${err}`)
                }
            }
        }
        catch (err) {
            console.log(`error when fetchAllBranchesFromNode for node ${remoteNode.name}: ${err}`)
        }
    }

    private async fetchFromNode(remoteNode: NodeApi.NodeApi, branch: string) {
        const BATCH_SIZE = 5

        let remoteHead = await remoteNode.blockChainHead(branch)

        // TODO : have a global context to do that :

        // - plan de rapatriement de blockId (quel bloc id par quel(s) peer(s))
        // - plan de rapatriement de block (quel bloc par quel(s) peer(s))
        // faire cela dans un timer. Objectif : 
        // - même si le réseau bouge beaucoup, se synchroniser petit à petit
        // - minimiser le flux réseau (ne pas demander le même block à plusieurs noeuds)

        // enregistrer que tel block est en provenance de tel(s) peer(s)
        // avoir un plan global de rapatriement
        // remonter par block-ids jusqu'à un block connu de notre noeud
        // alimenter plan de rapatriement de blocks

        // TODO load first the IDs then the blocks in batch and reverse size, so update is quicker on client

        let fetchList = [remoteHead]
        while (fetchList.length) {
            let toMaybeFetch = fetchList.shift()
            if (await this.node.knowsBlock(toMaybeFetch))
                continue

            let blockIds = await remoteNode.blockChainBlockIds(toMaybeFetch, BATCH_SIZE)

            console.log(`fetched ${blockIds.length} blocks`)

            let nbBlocksToLoad = 0
            for (let blockId of blockIds) {
                if (await this.node.knowsBlock(blockId))
                    break

                nbBlocksToLoad++
            }

            let blocks = await remoteNode.blockChainBlockData(toMaybeFetch, nbBlocksToLoad)

            if (blockIds && blocks) {
                for (let i = 0; i < blocks.length; i++) {
                    let block = blocks[i]
                    let blockId = blockIds[i]

                    if (await this.node.knowsBlock(blockId)) {
                        console.log(`finished transfer batch early`)
                        break
                    }

                    console.log(`transfer block ${blockId.substring(0, 5)} from ${remoteNode.name} to ${this.node.name}`)

                    await this.node.registerBlock(blockId, block)

                    block.previousBlockIds && block.previousBlockIds.forEach(previous => fetchList.push(previous))
                }
            }
        }
    }
}