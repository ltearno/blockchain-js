import * as OrderedJson from '../ordered-json'
import * as HashTools from '../hash-tools'

import * as forge from 'node-forge'

function testAes(msg, secret) {
    let encryptedAes = HashTools.encryptAes(msg, secret)
    let decryptedAes = HashTools.decryptAes(encryptedAes, secret)
    if (!HashTools.sameObjects(msg, decryptedAes))
        throw `error in AES 1`
}

function testAesEx(msg, secret) {
    let encryptedAes = HashTools.encryptAesEx(msg, secret)
    let decryptedAes = HashTools.decryptAesEx(encryptedAes, secret)
    if (!HashTools.sameObjects(msg, decryptedAes))
        throw `error in AES 1`
}

function testAesDouble(msg, secret) {
    let encryptedAes = HashTools.encryptAes(HashTools.encryptAes(msg, secret), secret)
    let decryptedAes = HashTools.decryptAes(HashTools.decryptAes(encryptedAes, secret), secret)
    if (!HashTools.sameObjects(msg, decryptedAes))
        throw `error in AES 2`
}

function testSign(msg, privateKey, publicKey) {
    let signature = HashTools.sign(msg, privateKey)
    console.log(`signature : ${signature}`)
    if (!HashTools.verify(msg, signature, publicKey))
        throw `verified (should be true)`

    msg.msg = 'altered'

    if (HashTools.verify(msg, signature, publicKey))
        throw `verified(should be false)`
}

function testSignAndPack(msg, privateKey) {
    let signedData = HashTools.signAndPackData(msg, privateKey)
    let isVerified = HashTools.verifyPackedData(signedData)
    let hisSignature = HashTools.extractPackedDataSignature(signedData)
    let hisPublicKey = HashTools.extractPackedDataPublicKey(signedData)

    if (!(isVerified && hisSignature && hisPublicKey))
        throw `failed testSignAndPack: ${isVerified} ${hisSignature} ${hisPublicKey} `
}

function testSignAndPack2(privateKey, publicKey) {
    let programPayload = {
        version: 0,
        code: 'blablabla',
        ownerPublicKey: publicKey
    }
    let signature = HashTools.sign(programPayload, privateKey)

    let programV2 = {
        version: 1,
        code: 'updated code',
        ownerPublicKey: publicKey
    }
    let sig2 = HashTools.sign(programV2, privateKey)

    programV2.code = 'nnn'

    let isFromOwner = HashTools.verify(programPayload, signature, programPayload.ownerPublicKey)
    let isFromOwner2 = HashTools.verify(programV2, sig2, programPayload.ownerPublicKey)
}

function testHybrid(msg, privateKey, publicKey) {
    let encryptedRsa = HashTools.encryptHybrid(msg, publicKey)
    let decryptedRsa = HashTools.decryptHybrid(encryptedRsa, privateKey)
    if (OrderedJson.stringify(msg) != OrderedJson.stringify(decryptedRsa))
        throw `failed hybrid encrypt/decrypt !`
}

async function test() {
    let msg: any = { msg: 'salut', num: 5 }
    for (let i = 0; i < 100; i++)
        //msg['m' + i] = 'lkjhlkjhlkjhlkjhlkjhlk jkh lkzje hlzkj helkjz hlezkjh lkjh'
        msg['m' + i] = 'helloéé^嗨，先生dzaldlhazkj dlazk嗨，先生jdh lzadg zaksj azhgkazjhgnkzejfhg zekfjh gfzjhg' + i * 2

    const secret = `k${Math.random()} `
    console.log(`secrect: ${secret} `)

    const { publicKey, privateKey } = await HashTools.generateRsaKeyPair()
    console.log(`public ${publicKey} `)
    console.log(`private ${privateKey} `)

    testAes(msg, secret)
    //testAesEx(msg,secret)
    testAesDouble(msg, secret)
    testSign(msg, privateKey, publicKey)
    testSignAndPack(msg, privateKey)
    testSignAndPack2(privateKey, publicKey)
    testHybrid(msg, privateKey, publicKey)

    console.log(`ended tests`)
}

test()