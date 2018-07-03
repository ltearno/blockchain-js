let bannedKeywords = ['document', 'window', 'os', 'console']

// init = ID (given by the user, should not already exist), PubKey, Code (with init method)
// update = OLD ID, NEW ID, sig, new code (with transformData method)
// execution of an updated program is forbidden

// call = programId + parameters

function createProgram(id, pubKey, code) {
}

let program = new Function(`
if(typeof process != "undefined") {
    process = {
        _tickCallback: process._tickCallback
    }
}

${bannedKeywords.map(kw => `if(typeof ${kw} != "undefined") ${kw} = undefined;`).join('\n')}

return (

// user's smart contract
{
    init: () => {
        return { value: 104 }
    },

    test: (data) => {
        data.value++
    }
}

)
`)

console.log(`program instance creation`)
let instance = program.apply(null)
if (typeof instance != "object") {
    console.error(`ERROR not an object !`)
    return
}

console.log(`call init on instance`)
let instanceData = instance.init()
console.log(`instance initial data: ${JSON.stringify(instanceData, null, 2)}`)

for (let i = 0; i < 10; i++) {
    let callResult = instance.test(instanceData)
    console.log(`instance data (after call): ${JSON.stringify(instanceData, null, 2)}`)
    if (callResult) {
        console.log(`call result : ${callResult}`)
        // TODO find an id for this data [eg sha(callparams)] and add it to the current block (question : as long as mining is free, ok, but we should provide credentials when not free ;))
    }
}