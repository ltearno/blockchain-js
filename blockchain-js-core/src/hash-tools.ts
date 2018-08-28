let hash = require('hash.js')
let cryptojs = require('crypto-js')
const NodeRSA = require('node-rsa')
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

export function generateRsaKeyPair() {
    const key = new NodeRSA(undefined, undefined, { encryptionScheme: 'pkcs1' })
    key.generateKeyPair(2048, 65537)

    return {
        privateKey: key.exportKey('pkcs8-private-pem'),
        publicKey: key.exportKey('pkcs8-public-pem')
    }
}

export function encryptRsa(data: any, publicKey: string): string {
    const key = new NodeRSA()
    key.importKey(publicKey)

    let result = key.encrypt(JSON.stringify(data), 'base64', 'utf8')
    return result
}

export function encryptRsaPrivate(data: any, privateKey: string): string {
    const key = new NodeRSA()
    key.importKey(privateKey)
    const result = key.encryptPrivate(JSON.stringify(data), 'base64', 'utf8')
    return result
}

export function decryptRsa(data: string, privateKey: string): any {
    const key = new NodeRSA()
    key.importKey(privateKey)

    let result = key.decrypt(data, 'json')
    return result
}
export function decryptRsaPublic(data: string, publicKey: string): any {
    const key = new NodeRSA()
    key.importKey(publicKey)

    let result = key.decryptPublic(data, 'utf8', 'base64')
    return JSON.parse(result)
}

export function sign(data: any, privateKey: string) {
    const key = new NodeRSA()
    key.importKey(privateKey)

    const result = key.sign(OrderedJson.stringify(data), 'base64', 'utf8')
    return result
}

export function verify(data: any, signature: string, publicKey: string) {
    const key = new NodeRSA()
    key.importKey(publicKey)

    const result = key.verify(OrderedJson.stringify(data), signature, 'utf8', 'base64')
    return result
}

interface SignedAndPackedData {
    body: any

    proof: {
        signature: string
        publicKey: string
    }
}

export function signAndPackData(data: object, privateKey: string) {
    data = JSON.parse(JSON.stringify(data))

    const key = new NodeRSA()
    key.importKey(privateKey)
    let publicKey = key.exportKey('pkcs8-public-pem')

    let signature = sign(data, privateKey)

    let result: SignedAndPackedData = {
        body: data,
        proof: {
            signature,
            publicKey
        }
    }

    return result
}

export function verifyPackedData(data: object) {
    if (!data || !data["body"] || !data["proof"])
        return false

    let packedData = JSON.parse(JSON.stringify(data)) as SignedAndPackedData

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

    return (JSON.parse(JSON.stringify(data)) as SignedAndPackedData).proof.signature
}

export function extractPackedDataPublicKey(data: object): string {
    if (!data || !data["body"] || !data["proof"])
        return undefined

    return (JSON.parse(JSON.stringify(data)) as SignedAndPackedData).proof.publicKey
}