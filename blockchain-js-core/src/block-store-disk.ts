import * as Block from './block'
import * as BlockStore from './block-store'

const level = require('level')

interface RawLevelDb {
    close: any
    put: any
    get: any
    createReadStream: any
}

class LevelDb {
    private db: RawLevelDb

    async init(path: string) {
        this.db = await this.openDatabase(path)
    }

    close(): Promise<boolean> {
        return new Promise((resolve, reject) => {
            this.db.close(err => {
                if (err)
                    reject(err)
                else
                    resolve()
            })
        })
    }

    private openDatabase(path: string): Promise<RawLevelDb> {
        return new Promise(resolve => {
            let db = level(path, null, () => {
                resolve(db)
            })
        })
    }

    private put(key: string, value: string): Promise<boolean> {
        return new Promise((resolve, reject) => {
            this.db.put(key, value, function (err) {
                if (err)
                    reject(err)
                resolve(true)
            })
        })
    }

    private get(name: string): Promise<string> {
        return new Promise((resolve, reject) => {
            this.db.get(name, function (err, value) {
                if (err)
                    reject(err)
                else
                    resolve(value)
            })
        })
    }

    // promise resolves to wether the iteration was completed
    private iterate(options: {
        gt?: string
        gte?: string
        lt?: string
        lte?: string
        reverse?: boolean
        limit?: number
        keys?: boolean
        values?: boolean
    }, callback: (key: string, value: string) => any): Promise<boolean> {
        return new Promise(resolve => {
            this.db.createReadStream(options)
                .on('data', data => callback(data.key, data.value))
                .on('error', err => resolve(false))
                .on('end', () => resolve(true))
        })
    }
}

/**
 * 
 * /blocks/{ID} : block data
 * /metadata/{ID} : block metadata
 * /waiting-blocks/{waited block ID}/{waiting block IDs} : no data, just the associtation is useful
 * /heads/{NAME}/current : blockId
 * 
 */

export class DiskBlockStore implements BlockStore.BlockStore {
    private db = new LevelDb()

    async init() {
        await this.db.init('./block-db')
    }

    async blockIds(callback: (blockId: string, block: Block.Block) => any) {
    }

    getBranches(): string[] {
        return []
    }

    getBranch(branch: string) {
        return []
    }

    getBranchHead(branch: string) {
        return ""
    }

    setBranchHead(branch: string, blockId: string) {
    }

    registerWaitingBlock(waitingBlockId: string, waitedBlockId: string) {
    }
    async browseWaitingBlocksAndForget(blockId: string, callback: (waitingBlockId) => any) {
    }

    blockCount(): number {
        return 0
    }
    blockMetadataCount(): number {
        return 0
    }
    hasBlockData(id: string): boolean {
        return false
    }
    getBlockData(id: string): Block.Block {
        return null
    }
    setBlockData(blockId: string, block: Block.Block) {
    }
    hasBlockMetadata(id: string): boolean {
        return false
    }
    getBlockMetadata(id: string): Block.BlockMetadata {
        return null
    }
    setBlockMetadata(id: string, metadata: Block.BlockMetadata) {
    }

    /*
        db.put('name', 'Level', function (err) {
            if (err) return console.log('Ooops!', err) // some kind of I/O error

            // 3) Fetch by key
            db.get('name', function (err, value) {
                if (err) return console.log('Ooops!', err) // likely the key was not found

                // Ta da!
                console.log('name=' + value)
            })
        })
    }*/
}