import * as HashTools from '../hash-tools'

import * as forge from 'node-forge'

async function test() {
    var rsa = forge.pki.rsa
    var keypair = rsa.generateKeyPair({ bits: 2048, e: 0x10001 })
    console.log(`keypair: ${keypair.privateKey} ${keypair.publicKey}`)
    console.log('publickey pem: ', forge.pki.publicKeyToPem(keypair.publicKey))
    console.log('privatekey pem: ', forge.pki.privateKeyToPem(keypair.privateKey))
    rsa.generateKeyPair({ bits: 2048, workers: 2 }, function (err, keypair) {
        console.log(`keypair: ${keypair.privateKey} ${keypair.publicKey}`)
    });

    const secret = `k${Math.random()}`
    let msg: any = { msg: 'salut', num: 5 }
    for (let i = 0; i < 100; i++)
        //msg['m' + i] = 'lkjhlkjhlkjhlkjhlkjhlk jkh lkzje hlzkj helkjz hlezkjh lkjh'
        msg['m' + i] = 'helloéé^嗨，先生dzaldlhazkj dlazk嗨，先生jdh lzadg zaksj azhgkazjhgnkzejfhg zekfjh gfzjhg' + i * 2

    let encryptedAes = HashTools.encryptAes(msg, secret)
    let decryptedAes = HashTools.decryptAes(encryptedAes, secret)
    if (!HashTools.sameObjects(msg, decryptedAes)) {
        console.error(`error in AES 1`)
        return
    }

    /*encryptedAes = HashTools.encryptAesEx(msg, secret)
    decryptedAes = HashTools.decryptAesEx(encryptedAes, secret)
    if (!HashTools.sameObjects(msg, decryptedAes)) {
        console.error(`error in AES 1`)
        return
    }*/

    encryptedAes = HashTools.encryptAes(HashTools.encryptAes(msg, secret), secret)
    decryptedAes = HashTools.decryptAes(HashTools.decryptAes(encryptedAes, secret), secret)
    if (!HashTools.sameObjects(msg, decryptedAes)) {
        console.error(`error in AES 2`)
        return
    }

    const { publicKey, privateKey } = await HashTools.generateRsaKeyPair()

    console.log(`public ${publicKey}`)
    console.log(`private ${privateKey}`)





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



    //msg = 'hello !'
    console.log(`clear: ${JSON.stringify(msg)}`)
    let encryptedRsa = HashTools.encryptHybrid(msg, publicKey)
    let decryptedRsa = HashTools.decryptHybrid(encryptedRsa, privateKey)
    console.log(`decrypted: ${JSON.stringify(decryptedRsa)}`)

    //let encryptedRsaP = HashTools.encryptRsaPrivate(msg, privateKey)
    //let decryptedRsaP = HashTools.decryptRsaPublic(encryptedRsaP, publicKey)

    console.log(`ended tests`)
}

test()