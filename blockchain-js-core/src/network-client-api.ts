export interface WebSocket {
    on(eventType: string, listener: (data: any) => any)
    send(data: string)
    close()
}

export interface NetworkClientApi {
    createClientWebSocket(endpoint: string): WebSocket

    get<T>(url: string): Promise<T>
    post<T>(url: string, data: any): Promise<T>
}