import * as Block from './block'
import * as NodeApi from './node-api'
import * as MinerApi from './miner-api'

// TODO improve : add signing and RW rights (root rights assigned to list creator ?)
interface ListItem {
    tag: 'DUMMY_LINKED_LIST'
    listName: string
    previousListItemData: string
    items: any[]
}

// READING :
// subscribe to the node => fetch latest data
// reverse browse the node's head and fetch blocks until root block
// browse blocks from root and filter list data, construct the chained list with that

async function idOfItem(index: number, item: any) {
    return `${index}-${await Block.idOfData(item)}`
}

function infoFromItemId(itemId: string): { index: number, dataId: string } {
    if (!itemId)
        return null

    let parts = itemId.split('-')
    if (!Array.isArray(parts) || parts.length != 2)
        return null

    return {
        index: parseInt(parts[0]),
        dataId: parts[1]
    }
}

/**
 * Follows a node and maintain a list data structure.
 * 
 * The list is named and there is always only one version of the list on a certain blockchain
 * 
 * Reading is always from the current version of the data at the node's state
 * Subscribing to list updates is possible
 * Writing is done by appending items to the list. Writes are not confirmed until the used 
 * node itself gets confirmation from new blocks in the blockchain containing the written
 * data list items.
 * Each item in the list is identified by a unique signature, so one can watch and wait until
 * a specific item is written.
 * - we know that an item has been written when a new confirmed block will contains the written record
 * - we know that an item has not been confirmed when a new version of the list contains an item with superior index
 */
export class ListOnChain {
    constructor(private node: NodeApi.NodeApi,
        private branch: string,
        private listName: string,
        private miner: MinerApi.MinerApi) { }

    private blocks = new Map<string, Block.Block>()

    private items: ListItem[]
    private list: any[]
    private itemsById: Map<string, number>

    private updating = false
    private queueUpdate = false

    private listeners: { (list): void }[] = []

    private nodeListener = () => this.updateFromNode()

    initialise() {
        this.node.addEventListener('head', null, this.nodeListener)
        this.updateFromNode()

        this.list = []
    }

    terminate() {
        this.node.removeEventListener(this.nodeListener)
        this.node = undefined
        this.items = undefined
        this.list = undefined
        this.itemsById = undefined

        this.listeners = undefined
    }

    getList(): any[] {
        return this.list
    }

    /**
     * @param itemId value returned by the addToList method
     * @returns -1 of the item is unknown, the index otherwise
     */
    indexOfItem(itemId: string): number {
        if (!this.itemsById || !this.itemsById.has(itemId))
            return -1

        return this.itemsById.get(itemId)
    }

    /**
     * Returns if an item is confirmed on the list.
     * 
     * Possible results are :
     * 
     * - undefined : the item is not yet written
     * - false : the item will never be written (it is deprecated)
     * - true : the item is confirmed on the list
     */
    isItemConfirmed(itemId: string): boolean | undefined {
        if (this.itemsById.has(itemId))
            return true

        let info = infoFromItemId(itemId)

        // if the list has already superior index items, it means
        // the requested index will never be partof the list (of course, 
        // as long as the underlying block stays in the considered-valid blockchain)
        if (info && this.list.length > info.index)
            return false

        return undefined
    }

    addListener(listener: (list: any[]) => void) {
        this.listeners.push(listener)
    }

    removeListener(listener) {
        this.listeners = this.listeners.filter(l => l != listener)
    }

    /**
     * Waits for an item to appear on the list.
     * 
     * Does not resolve until presence or absence is confirmed:
     * - Resolves to true when presence confirmed,
     * - Resolves to false when absence confirmed.
     */
    waitFor(itemId: string): Promise<boolean> {
        return new Promise((resolve, reject) => {
            let confirmation = this.isItemConfirmed(itemId)
            if (confirmation !== undefined) {
                resolve(confirmation)
            }
            else {
                let listener = list => {
                    let confirmation = this.isItemConfirmed(itemId)
                    if (confirmation === undefined)
                        return

                    resolve(confirmation)
                    this.removeListener(listener)
                }

                this.addListener(listener)
            }
        })
    }

    /**
     * 
     * @param items items to be added to the list
     * @returns a list of tokens that can be used to watch for list update
     */
    async addToList(items: any[]): Promise<string[]> {
        let newItem: ListItem = {
            tag: 'DUMMY_LINKED_LIST',
            listName: this.listName,
            previousListItemData: await this.lastListItemId(this.items),
            items
        }

        this.miner.addData(this.branch, newItem)

        let actualLength = this.list.length

        let res = []
        for (let i = 0; i < items.length; i++) {
            let item = items[i]

            let transactionId = await idOfItem(i + actualLength, item)
            res.push(transactionId)
        }
        return res
    }

    private async updateFromNode() {
        if (this.updating) {
            this.queueUpdate = true
            return
        }

        this.updating = true

        let previousLastListItemId = await this.lastListItemId(this.items)

        try {
            let head = await this.node.blockChainHead(this.branch)
            this.items = await this.fetchListItemsFromBlockchain(head)
            this.list = []
            this.itemsById = new Map()
            let itemIndex = 0
            for (let listItem of this.items) {
                this.list = this.list.concat(listItem.items)

                for (let item of listItem.items) {
                    let itemId = await idOfItem(itemIndex, item)
                    this.itemsById.set(itemId, itemIndex)
                    itemIndex++
                }
            }
        }
        catch (error) {
            console.log(`update error : ${error}`)
        }

        this.updating = false

        let currentLastListItemId = await this.lastListItemId(this.items)

        if (previousLastListItemId != currentLastListItemId)
            this.listeners.forEach(listener => listener(this.list))

        if (this.queueUpdate) {
            this.queueUpdate = false
            this.updateFromNode()
        }
    }

    private async fetchListItemsFromBlockchain(blockId: string): Promise<ListItem[]> {
        if (!blockId)
            return []

        let block = this.blocks.get(blockId)
        if (!block)
            block = (await this.node.blockChainBlockData(blockId, 1))[0]
        if (!block)
            throw `impossible to retrieve block`

        // TODO : should check that idOfBlock == blockId and that metadata.blockId==blockId

        // TODO should be able to manage multiple parents
        let firstPart = await this.fetchListItemsFromBlockchain(block.previousBlockIds && block.previousBlockIds[0])
        let lastDataId = await this.lastListItemId(firstPart)

        let lastPart = await this.findListPartInBlock(block, lastDataId)
        return firstPart.concat(lastPart)
    }

    private async lastListItemId(list: ListItem[]) {
        if (list && list.length)
            return await Block.idOfData(list[list.length - 1])
        return null
    }

    private async findListPartInBlock(block: Block.Block, lastItemData: string): Promise<ListItem[]> {
        let part: ListItem[] = []

        for (let dataItem of block.data) {
            if (typeof dataItem !== 'object')
                continue
            if (!['tag', 'listName', 'previousListItemData', 'items'].every(field => field in dataItem))
                continue

            if (dataItem.tag != 'DUMMY_LINKED_LIST')
                continue

            if (dataItem.listName != this.listName)
                continue

            if (dataItem.previousListItemData != lastItemData)
                continue

            if (!Array.isArray(dataItem.items))
                continue

            part.push(dataItem)
            lastItemData = await Block.idOfData(dataItem)
        }

        return part
    }
}