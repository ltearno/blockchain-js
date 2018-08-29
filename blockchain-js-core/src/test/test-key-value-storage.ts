import * as Block from '../block'
import * as NodeImpl from '../node-impl'
import * as MinerImpl from '../miner-impl'
import * as KeyValueStorage from '../key-value-storage'
import * as TestTools from '../test-tools'

const MAX_I = 3
const MAX_J = 3

let node = new NodeImpl.NodeImpl()
let miner = new MinerImpl.MinerImpl(node)
let keyValueStorage = new KeyValueStorage.KeyValueStorage(node, Block.MASTER_BRANCH, "test-storage", miner)
keyValueStorage.initialise()

async function main() {
    for (let j = 0; j < MAX_J; j++) {
        for (let i = 0; i < MAX_I; i++) {
            keyValueStorage.put('v', `${j} - ${i}`)
            keyValueStorage.put(`v-${i}-${j}`, i * j)
            keyValueStorage.put(`z${i}`, { i, j, vv: Math.random() })
            keyValueStorage.put(`z${Math.random()}`, { i, j, vv: Math.random() })
        }

        await TestTools.wait(20)
    }

    for (let j = 4; j < MAX_J; j++) {
        for (let i = 2; i < MAX_I; i++) {
            keyValueStorage.put('v', `${j} - ${i}`)
            keyValueStorage.put(`v-${i}-${j}`, i * j)
            keyValueStorage.put(`t${Math.random()}`, { i, j, v: Math.random() })
        }

        await TestTools.wait(10)
    }
}

function printValue(key: string) {
    let v = keyValueStorage.get(key)
    console.log(`${key}: ${JSON.stringify(v)}`)
}

async function testLoop() {
    while (true) {
        console.log(`=================== STATUS >>>>`)

        printValue('v')
        printValue('z2')

        for (let j = 0; j < MAX_J; j++) {
            for (let i = 0; i < MAX_I; i++) {
                printValue(`v-${i}-${j}`)
            }
        }

        console.log(`keys ALL : `, keyValueStorage.keys())
        console.log(`keys v-0 : `, keyValueStorage.keys('v-0'))
        console.log(`keys v-1: `, keyValueStorage.keys('v-1'))
        console.log(`keys y: `, keyValueStorage.keys('y'))
        console.log(`keys z: `, keyValueStorage.keys('z'))
        console.log(`keys a: `, keyValueStorage.keys('a'))

        console.log(`=================== STATUS <<<<`)

        await TestTools.wait(1000)
    }
}

main()
testLoop()