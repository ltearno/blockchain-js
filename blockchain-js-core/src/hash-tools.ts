let hash = require('hash.js')
let cryptojs = require('crypto-js')
//const NodeRSA = require('node-rsa')
import * as forge from 'node-forge'
import * as OrderedJson from './ordered-json'

export const EMPTY_PAYLOAD_SHA = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'

export async function hashString(value: string): Promise<string> {
    if (value === "")
        return EMPTY_PAYLOAD_SHA

    return hash.sha256().update(value).digest('hex')
}

export function encryptAes(data: any, secret: string) {
    return cryptojs.AES.encrypt(JSON.stringify(data), secret).toString()
}

export function decryptAes(data: string, secret: string) {
    const bytes = cryptojs.AES.decrypt(data, secret)
    return JSON.parse(bytes.toString(cryptojs.enc.Utf8))
}

export async function generateRsaKeyPair() {
    return new Promise<{ privateKey: string; publicKey: string }>((resolve, reject) => {
        const rsa = forge.pki.rsa

        try {
            rsa.generateKeyPair({ bits: 2048, workers: 2 }, (err, keyPair) => {
                if (err) {
                    reject(err)
                    return
                }

                resolve({
                    privateKey: forge.pki.privateKeyToPem(keyPair.privateKey),
                    publicKey: forge.pki.publicKeyToPem(keyPair.publicKey)
                })
            })
        }
        catch (err) {
            reject(err)
        }
    })
}

function encryptAesEx(data: string, key) {
    data = forge.util.encode64(data)

    var iv = forge.random.getBytesSync(16)

    var cipher = forge.cipher.createCipher('AES-CBC', key)

    cipher.start({ iv })
    cipher.update(forge.util.createBuffer(data))
    cipher.finish()

    return JSON.stringify({
        iv: forge.util.encode64(iv),
        encrypted: forge.util.encode64(cipher.output.getBytes())
    })
}

function decryptAesEx(encrypted: string, key) {
    let obj = JSON.parse(encrypted)

    let data = forge.util.createBuffer(forge.util.decode64(obj.encrypted))
    let iv = forge.util.createBuffer(forge.util.decode64(obj.iv))

    var decipher = forge.cipher.createDecipher('AES-CBC', key)
    decipher.start({ iv })
    decipher.update(data)
    decipher.finish()

    return forge.util.decode64(decipher.output.toString())
}

export function encryptRsa(data: any, publicKeyPem: string): string {

    let serializedData = OrderedJson.stringify(data)

    var key = forge.random.getBytesSync(16)

    let encrypted = encryptAesEx(serializedData, key)
    let decrypted = decryptAesEx(encrypted, key)

    /*let publicKey = forge.pki.publicKeyFromPem(publicKeyPem)
    let binaryData = clearBytes
    let encrypted = publicKey.encrypt(OrderedJson.stringify(data), 'RSA-OAEP', {
        md: forge.md.sha256.create(),
        mgf1: {
            md: forge.md.sha1.create()
        }
    })*/
    return encrypted // TODO check that it's a string
}

/*export function encryptRsaPrivate(data: any, privateKey: string): string {
    const key = new NodeRSA()
    key.importKey(privateKey)
    const result = key.encryptPrivate(JSON.stringify(data), 'base64', 'utf8')
    return result
}*/

export function decryptRsa(data: string, privateKey: string): any {
    let pk = forge.pki.privateKeyFromPem(privateKey)
    let decrypted = pk.decrypt(data)
    return OrderedJson.parse(decrypted) // TODO check decrypted is a string
}
/*export function decryptRsaPublic(data: string, publicKey: string): any {
    const key = new NodeRSA()
    key.importKey(publicKey)

    let result = key.decryptPublic(data, 'utf8', 'base64')
    return JSON.parse(result)
}*/

export function sign(data: any, privateKeyPem: string) {
    let md = forge.md.sha1.create()
    md.update(OrderedJson.stringify(data), 'utf8')

    let pk = forge.pki.privateKeyFromPem(privateKeyPem)
    let signature = forge.util.encode64(pk.sign(md))

    return signature
}

export function verify(data: any, signature: string, publicKeyPem: string) {
    var md = forge.md.sha1.create()
    md.update(OrderedJson.stringify(data), 'utf8')

    let pk = forge.pki.publicKeyFromPem(publicKeyPem)
    let verified = pk.verify(md.digest().bytes(), forge.util.decode64(signature))

    return verified
}

export interface SignedAndPackedData {
}

interface SignedAndPackedDataInternal extends SignedAndPackedData {
    body: any

    proof: {
        signature: string
        publicKey: string
    }
}

export function signAndPackData(data: object, privateKeyPem: string) {
    var md = forge.md.sha1.create()
    md.update(OrderedJson.stringify(data), 'utf8')

    let privateKey = forge.pki.privateKeyFromPem(privateKeyPem)
    let signature = forge.util.encode64(privateKey.sign(md))

    let publicKey = forge.pki.setRsaPublicKey(privateKey.n, privateKey.e)
    let publicKeyPem = forge.pki.publicKeyToPem(publicKey)

    let result: SignedAndPackedDataInternal = {
        body: data,
        proof: {
            signature,
            publicKey: publicKeyPem
        }
    }

    return result as any
}

export function verifyPackedData(data: object) {
    if (!data || !data["body"] || !data["proof"])
        return false

    let packedData = JSON.parse(JSON.stringify(data)) as SignedAndPackedDataInternal

    return verify(packedData.body, packedData.proof.signature, packedData.proof.publicKey)
}

export function extractPackedDataBody(data: object): any {
    if (!data || !data["body"] || !data["proof"])
        return undefined

    return data["body"]
}

export function extractPackedDataSignature(data: object): string {
    if (!data || !data["body"] || !data["proof"])
        return undefined

    return (JSON.parse(JSON.stringify(data)) as SignedAndPackedDataInternal).proof.signature
}

export function extractPackedDataPublicKey(data: object): string {
    if (!data || !data["body"] || !data["proof"])
        return undefined

    return (JSON.parse(JSON.stringify(data)) as SignedAndPackedDataInternal).proof.publicKey
}