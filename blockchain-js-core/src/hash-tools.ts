/**
 * TODO
 * 
 * node-forge AES encrypt/decrypt has a bug with UTF8 (it seems)
 * so for the moment we use AES implementation by crypto-js....
 * 
 * also payloads are way too much JSON parsed and stringified, so performance is very bad
 */

let hash = require('hash.js')
let cryptojs = require('crypto-js')
import * as forge from 'node-forge'
import * as OrderedJson from './ordered-json'

export function sameObjects(a, b) {
    return OrderedJson.stringify(a) == OrderedJson.stringify(b)
}

export const EMPTY_PAYLOAD_SHA = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'

export async function hashString(value: string): Promise<string> {
    var md = forge.md.sha256.create();
    md.update(value);
    return md.digest().toHex()

    /*if (value === "")
        return EMPTY_PAYLOAD_SHA

    return hash.sha256().update(value).digest('hex')*/
}

export function hashStringSync(value: string): string {
    var md = forge.md.sha256.create();
    md.update(value);
    return md.digest().toHex()

    /*
        if (value === "")
            return EMPTY_PAYLOAD_SHA
    
        return hash.sha256().update(value).digest('hex')
        */
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
            // should be 2048 !
            rsa.generateKeyPair({ bits: 512, workers: 2 }, (err, keyPair) => {
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

export function encryptAesEx(data: any, key) {
    //data = forge.util.encode64(JSON.stringify(data))

    let dataUtf8 = strToUTF8Arr(OrderedJson.stringify(data))
    let dataBase64 = base64EncArr(dataUtf8)

    var iv = forge.random.getBytesSync(16)

    var cipher = forge.cipher.createCipher('AES-CBC', key)

    cipher.start({ iv })
    cipher.update(forge.util.createBuffer(dataBase64))
    cipher.finish()

    const result = JSON.stringify({
        iv: forge.util.encode64(iv),
        encrypted: forge.util.encode64(cipher.output.getBytes())
    })

    // assert
    if (!sameObjects(decryptAesEx(result, key), data))
        console.error(`error aes !`)

    return result
}

export function decryptAesEx(encrypted: string, key) {
    let obj = JSON.parse(encrypted)

    let data = forge.util.createBuffer(forge.util.decode64(obj.encrypted))
    let iv = forge.util.createBuffer(forge.util.decode64(obj.iv))

    var decipher = forge.cipher.createDecipher('AES-CBC', key)
    decipher.start({ iv })
    decipher.update(data)
    decipher.finish()

    let dataUtf8 = base64DecToArr(decipher.output.toString(), undefined)
    let dataString = UTF8ArrToStr(dataUtf8)

    return JSON.parse(dataString)
    //return JSON.parse(forge.util.decode64(decipher.output.toString()))
}

export function encryptHybrid(data: any, publicKeyPem: string): string {
    let serializedData = OrderedJson.stringify(data)

    var key = forge.random.getBytesSync(16)
    let encryptedKey = encryptRsa(key, publicKeyPem)

    //let encrypted = encryptAesEx(serializedData, key)
    let encrypted = encryptAes(serializedData, key)

    return JSON.stringify({
        key: encryptedKey,
        data: encrypted
    })
}

export function decryptHybrid(encrypted: string, privateKeyPem: string): any {
    let { key, data } = JSON.parse(encrypted)

    let decryptedKey = decryptRsa(key, privateKeyPem)

    //let decrypted = decryptAesEx(data, decryptedKey)
    let decrypted = decryptAes(data, decryptedKey)

    return OrderedJson.parse(decrypted)
}

export function encryptRsa(data: any, publicKeyPem: string): string {
    let publicKey = forge.pki.publicKeyFromPem(publicKeyPem)
    //let binaryData = clearBytes
    let encrypted = publicKey.encrypt(OrderedJson.stringify(data), 'RSA-OAEP')

    return encrypted // TODO check that it's a string
}

export function decryptRsa(data: string, privateKey: string): any {
    let pk = forge.pki.privateKeyFromPem(privateKey)
    let decrypted = pk.decrypt(data, 'RSA-OAEP')
    return OrderedJson.parse(decrypted) // TODO check decrypted is a string
}

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

export function signAndPackData(data: object | string | number | boolean, privateKeyPem: string) {
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














"use strict";

/*\
|*|
|*|  utilitairezs de manipulations de chaînes base 64 / binaires / UTF-8
|*|
|*|  https://developer.mozilla.org/fr/docs/Décoder_encoder_en_base64
|*|
\*/

/* Décoder un tableau d'octets depuis une chaîne en base64 */

function b64ToUint6(nChr) {

    return nChr > 64 && nChr < 91 ?
        nChr - 65
        : nChr > 96 && nChr < 123 ?
            nChr - 71
            : nChr > 47 && nChr < 58 ?
                nChr + 4
                : nChr === 43 ?
                    62
                    : nChr === 47 ?
                        63
                        :
                        0;

}

function base64DecToArr(sBase64, nBlocksSize) {

    var
        sB64Enc = sBase64.replace(/[^A-Za-z0-9\+\/]/g, ""), nInLen = sB64Enc.length,
        nOutLen = nBlocksSize ? Math.ceil((nInLen * 3 + 1 >> 2) / nBlocksSize) * nBlocksSize : nInLen * 3 + 1 >> 2, taBytes = new Uint8Array(nOutLen);

    for (var nMod3, nMod4, nUint24 = 0, nOutIdx = 0, nInIdx = 0; nInIdx < nInLen; nInIdx++) {
        nMod4 = nInIdx & 3;
        nUint24 |= b64ToUint6(sB64Enc.charCodeAt(nInIdx)) << 18 - 6 * nMod4;
        if (nMod4 === 3 || nInLen - nInIdx === 1) {
            for (nMod3 = 0; nMod3 < 3 && nOutIdx < nOutLen; nMod3++ , nOutIdx++) {
                taBytes[nOutIdx] = nUint24 >>> (16 >>> nMod3 & 24) & 255;
            }
            nUint24 = 0;

        }
    }

    return taBytes;
}

/* encodage d'un tableau en une chaîne en base64 */

function uint6ToB64(nUint6) {

    return nUint6 < 26 ?
        nUint6 + 65
        : nUint6 < 52 ?
            nUint6 + 71
            : nUint6 < 62 ?
                nUint6 - 4
                : nUint6 === 62 ?
                    43
                    : nUint6 === 63 ?
                        47
                        :
                        65;

}

function base64EncArr(aBytes) {

    var nMod3 = 2, sB64Enc = "";

    for (var nLen = aBytes.length, nUint24 = 0, nIdx = 0; nIdx < nLen; nIdx++) {
        nMod3 = nIdx % 3;
        if (nIdx > 0 && (nIdx * 4 / 3) % 76 === 0) { sB64Enc += "\r\n"; }
        nUint24 |= aBytes[nIdx] << (16 >>> nMod3 & 24);
        if (nMod3 === 2 || aBytes.length - nIdx === 1) {
            sB64Enc += String.fromCharCode(uint6ToB64(nUint24 >>> 18 & 63), uint6ToB64(nUint24 >>> 12 & 63), uint6ToB64(nUint24 >>> 6 & 63), uint6ToB64(nUint24 & 63));
            nUint24 = 0;
        }
    }

    return sB64Enc.substr(0, sB64Enc.length - 2 + nMod3) + (nMod3 === 2 ? '' : nMod3 === 1 ? '=' : '==');

}

/* Tableau UTF-8 en DOMString et vice versa */

function UTF8ArrToStr(aBytes) {

    var sView = "";

    for (var nPart, nLen = aBytes.length, nIdx = 0; nIdx < nLen; nIdx++) {
        nPart = aBytes[nIdx];
        sView += String.fromCharCode(
            nPart > 251 && nPart < 254 && nIdx + 5 < nLen ? /* six bytes */
                /* (nPart - 252 << 32) n'est pas possible pour ECMAScript donc, on utilise un contournement... : */
                (nPart - 252) * 1073741824 + (aBytes[++nIdx] - 128 << 24) + (aBytes[++nIdx] - 128 << 18) + (aBytes[++nIdx] - 128 << 12) + (aBytes[++nIdx] - 128 << 6) + aBytes[++nIdx] - 128
                : nPart > 247 && nPart < 252 && nIdx + 4 < nLen ? /* five bytes */
                    (nPart - 248 << 24) + (aBytes[++nIdx] - 128 << 18) + (aBytes[++nIdx] - 128 << 12) + (aBytes[++nIdx] - 128 << 6) + aBytes[++nIdx] - 128
                    : nPart > 239 && nPart < 248 && nIdx + 3 < nLen ? /* four bytes */
                        (nPart - 240 << 18) + (aBytes[++nIdx] - 128 << 12) + (aBytes[++nIdx] - 128 << 6) + aBytes[++nIdx] - 128
                        : nPart > 223 && nPart < 240 && nIdx + 2 < nLen ? /* three bytes */
                            (nPart - 224 << 12) + (aBytes[++nIdx] - 128 << 6) + aBytes[++nIdx] - 128
                            : nPart > 191 && nPart < 224 && nIdx + 1 < nLen ? /* two bytes */
                                (nPart - 192 << 6) + aBytes[++nIdx] - 128
                                : /* nPart < 127 ? */ /* one byte */
                                nPart
        );
    }

    return sView;

}

function strToUTF8Arr(sDOMStr) {

    var aBytes, nChr, nStrLen = sDOMStr.length, nArrLen = 0;

    /* mapping... */

    for (var nMapIdx = 0; nMapIdx < nStrLen; nMapIdx++) {
        nChr = sDOMStr.charCodeAt(nMapIdx);
        nArrLen += nChr < 0x80 ? 1 : nChr < 0x800 ? 2 : nChr < 0x10000 ? 3 : nChr < 0x200000 ? 4 : nChr < 0x4000000 ? 5 : 6;
    }

    aBytes = new Uint8Array(nArrLen);

    /* transcription... */

    for (var nIdx = 0, nChrIdx = 0; nIdx < nArrLen; nChrIdx++) {
        nChr = sDOMStr.charCodeAt(nChrIdx);
        if (nChr < 128) {
            /* one byte */
            aBytes[nIdx++] = nChr;
        } else if (nChr < 0x800) {
            /* two bytes */
            aBytes[nIdx++] = 192 + (nChr >>> 6);
            aBytes[nIdx++] = 128 + (nChr & 63);
        } else if (nChr < 0x10000) {
            /* three bytes */
            aBytes[nIdx++] = 224 + (nChr >>> 12);
            aBytes[nIdx++] = 128 + (nChr >>> 6 & 63);
            aBytes[nIdx++] = 128 + (nChr & 63);
        } else if (nChr < 0x200000) {
            /* four bytes */
            aBytes[nIdx++] = 240 + (nChr >>> 18);
            aBytes[nIdx++] = 128 + (nChr >>> 12 & 63);
            aBytes[nIdx++] = 128 + (nChr >>> 6 & 63);
            aBytes[nIdx++] = 128 + (nChr & 63);
        } else if (nChr < 0x4000000) {
            /* five bytes */
            aBytes[nIdx++] = 248 + (nChr >>> 24);
            aBytes[nIdx++] = 128 + (nChr >>> 18 & 63);
            aBytes[nIdx++] = 128 + (nChr >>> 12 & 63);
            aBytes[nIdx++] = 128 + (nChr >>> 6 & 63);
            aBytes[nIdx++] = 128 + (nChr & 63);
        } else /* if (nChr <= 0x7fffffff) */ {
            /* six bytes */
            aBytes[nIdx++] = 252 + /* (nChr >>> 32) is not possible in ECMAScript! So...: */ (nChr / 1073741824);
            aBytes[nIdx++] = 128 + (nChr >>> 24 & 63);
            aBytes[nIdx++] = 128 + (nChr >>> 18 & 63);
            aBytes[nIdx++] = 128 + (nChr >>> 12 & 63);
            aBytes[nIdx++] = 128 + (nChr >>> 6 & 63);
            aBytes[nIdx++] = 128 + (nChr & 63);
        }
    }

    return aBytes;

}