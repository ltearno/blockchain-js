import * as Block from './block'
import * as BlockStore from './block-store'

const level = require('level')

interface RawLevelDb {
    close: any
    put: any
    get: any
    del: any
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

    put(key: string, value: string): Promise<boolean> {
        return this.db.put(key, value)
    }

    async has(name: string): Promise<boolean> {
        let result = false
        await this.iterate({ gte: name, lte: name, values: false, keys: false }, () => result = true)
        return result
    }

    get(name: string): Promise<string> {
        return this.db.get(name)
    }

    del(name: string): Promise<void> {
        return this.db.del(name)
    }

    // promise resolves to wether the iteration was completed
    iterate(options: {
        gt?: string
        gte?: string
        lt?: string
        lte?: string
        reverse?: boolean
        limit?: number
        keys: boolean
        values: boolean
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
 * /stats/block-count
 * /stats/metadata-count
 * /blocks/{ID} : block data
 * /branches/{NAME} : blockId
 * /metadata/{ID} : block metadata
 * /waiting-blocks/{waited block ID}/{waiting block IDs} : no data, just the associtation is useful
 * 
 */

export class DiskBlockStore implements BlockStore.BlockStore {
    private db = new LevelDb()

    async init() {
        await this.db.init('./block-db')
    }

    async blocks(callback: (blockId: string, block: Block.Block) => any) {
        this.db.iterate(
            {
                gte: '/blocks/',
                lt: '/blocks}',
                keys: true,
                values: true
            }, (key, value) => {
                callback(key.substr('/blocks/'.length), JSON.parse(value))
            })
    }

    async getBranches() {
        let result: string[] = []

        await this.db.iterate(
            {
                gte: '/branches/',
                lt: '/branches}',
                keys: true,
                values: false
            },
            (key, _) => result.push(key.substr('/branches/'.length))
        )

        return result
    }

    async getBranchHead(branch: string) {
        return this.db.get(`/branch/${branch}`)
    }

    async setBranchHead(branch: string, blockId: string) {
        await this.db.put(`/branch/${branch}`, blockId)
    }

    async registerWaitingBlock(waitingBlockId: string, waitedBlockId: string) {
        await this.db.put(`/waiting-blocks/${waitedBlockId}/${waitingBlockId}`, "")
    }

    async browseWaitingBlocksAndForget(blockId: string, callback: (waitingBlockId) => any) {
        await this.db.iterate(
            {
                gte: `/waiting-blocks/${blockId}/`,
                lt: `/waiting-blocks/${blockId}}`,
                keys: true,
                values: false
            },
            (key, _) => callback(key.substr(`/waiting-blocks/${blockId}/`.length))
        )
    }

    async blockCount() {
        try {
            return parseInt(await this.db.get('/stats/block-count'))
        }
        catch (_) {
            return 0
        }
    }

    async blockMetadataCount() {
        try {
            return parseInt(await this.db.get('/stats/metadata-count'))
        }
        catch (_) {
            return 0
        }
    }

    async hasBlockData(id: string) {
        return await this.db.has(`/blocks/${id}`)
    }

    async getBlockData(id: string) {
        return JSON.parse(await this.db.get(`/blocks/${id}`))
    }

    async setBlockData(blockId: string, block: Block.Block) {
        await this.db.put(`/block/${blockId}`, JSON.stringify(block))
    }

    async hasBlockMetadata(id: string) {
        return await this.db.has(`/metadata/${id}`)
    }

    async getBlockMetadata(id: string) {
        return JSON.parse(await this.db.get(`/metadata/${id}`))
    }

    async setBlockMetadata(id: string, metadata: Block.BlockMetadata) {
        await this.db.put(`/metadata/${id}`, JSON.stringify(metadata))
    }
}