import crypto = require('crypto')

export const EMPTY_PAYLOAD_SHA = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

export function hashString(value: string): string {
    if (value === "")
        return EMPTY_PAYLOAD_SHA

    let hash = crypto.createHash('sha256')
    hash.update(value)
    return hash.digest('hex')
}
