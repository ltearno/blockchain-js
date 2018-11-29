import { SmartContract, HashTools } from "blockchain-js-core"
import * as Model from "./supply-chain/model"

const SUPPLY_CHAIN_CONTRACT_ID = "supply-chain-v1"

export const EMPTY_STATE = {
    accounts: {},
    artWorks: {},
    redistributableItems: []
}

export class SupplyChainAdapter {
    private smartContract: SmartContract.SmartContract = null

    setSmartContract(smartContract: SmartContract.SmartContract) {
        this.smartContract = smartContract
    }

    getSuppyChainState(): Model.ProgramState {
        if (!this.smartContract)
            return EMPTY_STATE

        let result = this.smartContract.getContractState(SUPPLY_CHAIN_CONTRACT_ID)
        return result || EMPTY_STATE
    }

    async createAccount(account) {
        return await this.callContract('createAccount', {}, account)
    }

    async hasAccount(id) {
        return await this.simulateContract('hasAccount', { id })
    }

    async registerArtWork(artWork: Model.ArtWork) {
        return await this.callContract('registerArtWork', { artWork })
    }

    async validateArtWork(artWorkId: string) {
        return await this.callContract('validateArtWork', { artWorkId })
    }

    async removeCellFromArtWork(artWorkId: string, x: number, y: number) {
        return await this.callContract('removeCellFromArtWork', { artWorkId, x, y })
    }

    async addItemInArtWorkFromInventory(artWorkId: string, itemId: string, x: number, y: number) {
        return await this.callContract('addItemInArtWorkFromInventory', { artWorkId, itemId, x, y })
    }

    async sendMessageOnArtWork(userId: string, artWorkId: string, text: string) {
        return await this.callContract('sendMessageOnArtWork', { userId, artWorkId, text })
    }

    async updateArtWorkTitle(artWorkId: string, title: string) {
        return await this.callContract('updateArtWorkTitle', { artWorkId, title })
    }
    
    async updateArtWorkSize(artWorkId: string, width: number, height: number) {
        return await this.callContract('updateArtWorkSize', { artWorkId, width, height })
    }

    private async callContract(method, data, account = null) {
        if (account)
            data.id = account.id
        if (this.smartContract.hasContract(SUPPLY_CHAIN_CONTRACT_ID)) {
            let callId = await this.smartContract.callContract(SUPPLY_CHAIN_CONTRACT_ID, 0, method, account ? HashTools.signAndPackData(data, account.keys.privateKey) : data)
            return await waitReturn(this.smartContract, callId)
        }

        return false
    }

    private async simulateContract(method, data, account = null) {
        if (account)
            data.id = account.id
        if (this.smartContract.hasContract(SUPPLY_CHAIN_CONTRACT_ID)) {
            return await this.smartContract.simulateCallContract(SUPPLY_CHAIN_CONTRACT_ID, 0, method, account ? HashTools.signAndPackData(data, account.keys.privateKey) : data)
        }

        return false
    }
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