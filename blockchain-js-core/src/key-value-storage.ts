import * as Block from './block'
import * as NodeApi from './node-api'
import * as MinerApi from './miner-api'

interface KeyValueStorageDataItem {
    tag: string
    items: {
        [key: string]: any
    }
}

interface ProcessingData {
    items: {
        [key: string]: {
            value: any,
            origin: string,
            refused: string[]
        }
    }

    seenBlocks: Set<string>
}

export class KeyValueStorage {
    constructor(
        private node: NodeApi.NodeApi,
        private branch: string,
        private storageId: string,
        private miner: MinerApi.MinerApi) { }

    private nodeListener = () => this.updateFromNode()

    initialise() {
        this.node.addEventListener('head', null, this.nodeListener)
        this.updateFromNode()
    }

    terminate() {
        this.node.removeEventListener(this.nodeListener)
        this.node = undefined
    }

    dataForPut(key: string, value: any) {
        let items = {}
        items[key] = value

        return { tag: `kvs-${this.storageId}`, items }
    }

    put(key: string, value: any, miner: MinerApi.MinerApi = this.miner) {
        let dataToAdd = this.dataForPut(key, value)
        miner.addData(this.branch, dataToAdd)
    }

    get(key: string) {
        if (!this.lastProcessing)
            return undefined

        let data = this.lastProcessing.items[key]
        if (!data)
            return undefined

        return data.value
    }

    keys(prefix: string = undefined) {
        if (!this.lastProcessing)
            return []

        return Object.keys(this.lastProcessing.items)
            .filter(k => !prefix || k.startsWith(prefix))
            .sort()
    }

    private processingCount = 0

    private lastProcessingVersion = -1
    private lastProcessing: ProcessingData = null

    private async updateFromNode() {
        let head = await this.node.blockChainHead(this.branch)
        console.log(`loaded node head ${head}, start processing`)

        let currentCount = this.processingCount++
        let data = {
            items: {},
            seenBlocks: new Set<string>()
        }
        let result = await this.processBlock(head, currentCount, data)

        console.log(`data : ${JSON.stringify(data, null, 2)}`)

        console.log(`finished processing ${currentCount} with result ${result}`)

        if (currentCount > this.lastProcessingVersion) {
            this.lastProcessingVersion = currentCount
            this.lastProcessing = data

            console.log(`validated data processing round ${currentCount}`)
        }
    }

    private async processBlock(blockId, processingCount, processData: ProcessingData) {
        if (!blockId)
            return false

        if (processData.seenBlocks.has(blockId)) {
            console.log(`already seen block ${blockId}`)
            return true
        }

        processData.seenBlocks.add(blockId)

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

        //console.log(`processing[${processingCount}] ${blockMetadata.blockId} of confidence ${blockMetadata.confidence}, depth ${blockMetadata.blockCount}`)
        let kvsItems = await this.findKeyValueStoragePartsInBlock(blockData)
        //console.log(`kvsItems[${processingCount}]-block ${blockId.substr(0, 5)} ${JSON.stringify(kvsItems)}`)

        if (kvsItems) {
            for (let kvsItemIndex in kvsItems) {
                const kvsItem = kvsItems[kvsItemIndex]
                for (let key in kvsItem.items) {
                    if (key in processData.items) {
                        console.log(`ALREADY HAVE KEY ${key}`)
                        processData.items[key].refused.push(`${blockId}-${kvsItemIndex}`)
                        continue
                    }

                    processData.items[key] = {
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
