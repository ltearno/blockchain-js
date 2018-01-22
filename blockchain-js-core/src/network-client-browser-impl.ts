import * as NetworkApi from './network-api'

export class NetworkClientBrowserImpl implements NetworkApi.NetworkApi {
    createClientWebSocket(endpoint: string): NetworkApi.WebSocket {
        let socket = new WebSocket(endpoint)

        let result: NetworkApi.WebSocket = {
            close: () => socket.close(),
            on: (eventType: string, listener: (data: any) => any) => {
                if (eventType === 'message')
                    return socket.addEventListener('message', event => listener(event.data))

                socket.addEventListener(eventType, listener)
            },
            send: (data: string) => socket.send(data)
        }

        return result
    }

    get<T>(url: string): Promise<T> {
        return new Promise((resolve, reject) => {
            let request = new XMLHttpRequest()

            request.onerror = error => reject(error)
            request.onload = () => resolve(request.responseText == "" ? null : JSON.parse(request.responseText))
            request.open("get", url)
            request.send(null)
        })
    }

    post<T>(url: string, data: any): Promise<T> {
        return new Promise((resolve, reject) => {
            let request = new XMLHttpRequest()

            request.onerror = error => reject(error)
            request.onload = () => resolve(request.responseText == "" ? null : JSON.parse(request.responseText))
            request.open("post", url)
            request.setRequestHeader("Content-Type", "application/json")
            request.send(JSON.stringify(data))
        })
    }
}