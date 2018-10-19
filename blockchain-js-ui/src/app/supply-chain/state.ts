import { ProgramState } from './model'
import { Injectable } from '@angular/core'
import * as SupplyChainAdapter from '../supply-chain-adapter'

@Injectable()
export class State {
    userId: string = "ltearno@gmail.com"

    suppyChain: SupplyChainAdapter.SupplyChainAdapter = new SupplyChainAdapter.SupplyChainAdapter()

    get programState(): ProgramState {
        return this.suppyChain.getSuppyChainState()
    }
}