/**
 * Almost the same as JSON.stringify().
 * Except that object dumps are totally ordered. No space between elements...
 * 
 * strict json data format (total order between payloads)
 */
export function stringify(data: any): string {
    if (Array.isArray(data))
        return `[${(data as any[]).map(item => stringify(item)).join(',')}]`

    if (data && typeof data === 'object')
        return `{${Object.getOwnPropertyNames(data)
            .sort()
            .filter(name => data[name] !== undefined)
            .map(name => `"${name}":${stringify(data[name])}`)}}`

    if (typeof data === 'string')
        return JSON.stringify(data)

    if (typeof data === 'number')
        return JSON.stringify(data)

    if (typeof data === 'boolean')
        return JSON.stringify(data)

    if (data === null)
        return 'null'

    throw `unknown data for serializtion ${JSON.stringify(data)}`
}

export function parse(representation: string) {
    return JSON.parse(representation)
}