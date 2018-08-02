import * as Block from './block'
import * as NodeApi from './node-api'
import * as MinerImpl from './miner-impl'

interface KeyValueStorageDataItem {
    tag: string
    items: {
        [key: string]: any
    }
}

export class KeyValueStorage {
    constructor(
        private node: NodeApi.NodeApi,
        private branch: string,
        private storageId: string,
        private miner: MinerImpl.MinerImpl) { }

    private nodeListener = () => this.updateFromNode()

    initialise() {
        this.node.addEventListener('head', this.nodeListener)
        this.updateFromNode()
    }

    terminate() {
        this.node.removeEventListener(this.nodeListener)
        this.node = undefined
    }

    private processingCount = 0

    private async updateFromNode() {
        let head = await this.node.blockChainHead(this.branch)
        console.log(`loaded node head ${head}, start processing`)

        let currentCount = this.processingCount++
        let data = {}
        let result = await this.processBlock(head, currentCount, data)

        console.log(`data : ${JSON.stringify(data, null, 2)}`)

        console.log(`finished processing ${currentCount} with result ${result}`)
    }

    // TODO process blocks only once in ncase of multiple parents !

    private async processBlock(blockId, processingCount, processData) {
        if (!blockId)
            return false

        let blockMetadatas = await this.node.blockChainBlockMetadata(blockId, 1)
        if (!blockMetadatas || !blockMetadatas.length) {
            console.error(`error : cannot find block metadata ${blockId}`)
            return false
        }

        let blockDatas = await this.node.blockChainBlockData(blockId, 1)
        if (!blockDatas || !blockDatas.length) {
            console.error(`error : cannot find block data ${blockId}`)
            return false
        }

        const blockMetadata = blockMetadatas[0]
        const blockData = blockDatas[0]

        if (blockMetadata.previousBlockIds && blockMetadata.previousBlockIds.length) {
            for (let parentBlockId of blockMetadata.previousBlockIds) {
                let result = await this.processBlock(parentBlockId, processingCount, processData)
                if (!result) {
                    console.error(`parent block ${parentBlockId} processing failed, aborting processing of ${blockId}`)
                    return false
                }
            }
        }

        console.log(`processing[${processingCount}] ${blockMetadata.blockId} of confidence ${blockMetadata.confidence}, depth ${blockMetadata.blockCount}`)
        let kvsItems = await this.findKeyValueStoragePartsInBlock(blockData)
        console.log(`kvsItems[${processingCount}]-block ${blockId.substr(0, 5)} ${JSON.stringify(kvsItems)}`)

        if (kvsItems) {
            for (let kvsItem of kvsItems) {
                for (let key in kvsItem.items) {
                    if (key in processData) {
                        console.log(`ALREADY HAVE KEY ${key}`)
                        processData[key].refused.push(blockId)
                        continue
                    }

                    processData[key] = {
                        value: kvsItem.items[key],
                        origin: blockId,
                        refused: []
                    }
                }
            }
        }

        return true
    }

    private async findKeyValueStoragePartsInBlock(block: Block.Block) {
        let result: KeyValueStorageDataItem[] = []

        for (let dataItem of block.data) {
            if (typeof dataItem !== 'object')
                continue

            if (!['tag', 'items'].every(field => field in dataItem))
                continue

            if (dataItem.tag != `kvs-${this.storageId}`)
                continue

            if (!(dataItem.items instanceof Object))
                continue

            result.push(dataItem as KeyValueStorageDataItem)
        }

        return result
    }
}

