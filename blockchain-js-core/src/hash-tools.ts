let hash = require('hash.js')
let crypto = require('crypto-js')
let jsencrypt = require('jsencrypt')

export const EMPTY_PAYLOAD_SHA = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'

export async function hashString(value: string): Promise<string> {
    if (value === "")
        return EMPTY_PAYLOAD_SHA

    return hash.sha256().update(value).digest('hex')
}

export function encryptAes(data: any, secret: string) {
    return crypto.AES.encrypt(JSON.stringify(data), secret).toString()
}

export function decryptAes(data: string, secret: string) {
    const bytes = crypto.AES.decrypt(data, secret)
    return JSON.parse(bytes.toString(crypto.enc.Utf8))
}

export function generateRsaKeyPair() {
    const crypt = new jsencrypt({ default_key_size: 2056 })
    const privateKey = crypt.getPrivateKey()
    const publicKey = crypt.getPublicKey()
    return { publicKey, privateKey }
}

export function encryptRSA(data: any, publicKey: string) {
    const encrypt = new jsencrypt()
    encrypt.setPublicKey(publicKey)
    const encrypted = encrypt.encrypt(JSON.stringify(data))
    return encrypted
}

export function decryptRSA(data: string, privateKey: string) {
    const decrypt = new jsencrypt()
    decrypt.setPrivateKey(privateKey)
    const uncrypted = decrypt.decrypt(data)
    return uncrypted
}