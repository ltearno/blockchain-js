let bannedKeywords = ['document', 'window', 'os', 'console']

// init = ID (given by the user, should not already exist), PubKey, Code (with init method)
// update = ID, sig, new code (with transformData method)

function createProgram(id, pubKey, code) {
}

let program = new Function(`
if(typeof process != "undefined") {
    process = {
        _tickCallback: process._tickCallback
    }
}

${bannedKeywords.map(kw => `if(typeof ${kw} != "undefined") ${kw} = null;`).join('\n')}

return (

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
    instance.test(instanceData)
    console.log(`instance data (after call): ${JSON.stringify(instanceData, null, 2)}`)
}