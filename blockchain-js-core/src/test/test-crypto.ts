import * as HashTools from '../hash-tools'

const secret = `k${Math.random()}`
const msg = { msg: 'salut', num: 5 }
for (let i = 0; i < 100; i++)
    msg['m' + i] = 'dzaldlhazkj dlazkjdh lzadg zaksj azhgkazjhgnkzejfhg zekfjh gfzjhg' + i * 2

const encryptedAes = HashTools.encryptAes(msg, secret)
const decryptedAes = HashTools.decryptAes(encryptedAes, secret)

const { publicKey, privateKey } = HashTools.generateRsaKeyPair()

console.log(`public ${publicKey}`)
console.log(`private ${privateKey}`)

let encryptedRsa = HashTools.encryptRsa(msg, publicKey)
let decryptedRsa = HashTools.decryptRsa(encryptedRsa, privateKey)

let encryptedRsaP = HashTools.encryptRsaPrivate(msg, privateKey)
let decryptedRsaP = HashTools.decryptRsaPublic(encryptedRsaP, publicKey)


let signature = HashTools.sign(msg, privateKey)
console.log(`signature : ${signature}`)
let verified = HashTools.verify(msg, signature, publicKey)
console.log(`verified (should be true) : ${verified}`)
msg.msg = 'altered'
verified = HashTools.verify(msg, signature, publicKey)
console.log(`verified (should be false) : ${verified}`)

let signedData = HashTools.signAndPackData(msg, privateKey)
let isVerified = HashTools.verifyPackedData(signedData)
let hisSignature = HashTools.extractPackedDataSignature(signedData)
let hisPublicKey = HashTools.extractPackedDataPublicKey(signedData)
console.log(`checked : ${isVerified} ${hisSignature} ${hisPublicKey}`)

let programPayload = {
    version: 0,
    code: 'blablabla',
    ownerPublicKey: publicKey
}
signature = HashTools.sign(programPayload, privateKey)

let programV2 = {
    version: 1,
    code: 'updated code',
    ownerPublicKey: publicKey
}
let sig2 = HashTools.sign(programV2, privateKey)

programV2.code = 'nnn'

let isFromOwner = HashTools.verify(programPayload, signature, programPayload.ownerPublicKey)
let isFromOwner2 = HashTools.verify(programV2, sig2, programPayload.ownerPublicKey)

