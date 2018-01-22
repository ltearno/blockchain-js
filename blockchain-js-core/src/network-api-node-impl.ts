import * as NetworkApi from './network-api'
import * as WebSocket from 'ws'
import * as Request from 'request'

export class NetworkApiNodeImpl implements NetworkApi.NetworkApi {
    createClientWebSocket(endpoint: string): NetworkApi.WebSocket {
        return new WebSocket(endpoint)
    }

    get<T>(url: string): Promise<T> {
        return new Promise((resolve, reject) => {
            Request.get(url, (error, response, body) => {
                if (error) {
                    reject(error)
                    return
                }

                try {
                    resolve(JSON.parse(body))
                }
                catch (err) {
                    reject(err)
                }
            })
        })
    }

    post<T>(url: string, data: any): Promise<T> {
        return new Promise((resolve, reject) => {
            Request.post(
                url, {
                    method: 'POST',
                    json: true,
                    body: data
                }, (error, response, body) => {
                    if (error)
                        reject(error)
                    else
                        resolve(body)
                })
        })
    }
}