import * as Messages from './messages'

export interface SocketAPI {
    on(eventType: string, listener: (data: any) => any)
    send(data: string)
    close()
}

export interface ChannelDescription {
    offerId: string
    counterPartyMessage: string
    isSelfInitiated: boolean
}

export class PeerToPeerBrokering {
    private signalingSocket: WebSocket
    ready: boolean = false

    private fakeSockets = new Map<string, FakeWebSocket>()

    constructor(private url: string,
        private onReady: () => void,
        private acceptOffer: (offerId: string, offerMessage: string) => { accepted: boolean; message: string },
        private onChannelOpened: (channelDescription: ChannelDescription, channel: SocketAPI) => void) { }

    createSignalingSocket() {
        if (this.signalingSocket)
            return

        console.log(`connecting peer to peer broker`)

        this.ready = false
        this.signalingSocket = new WebSocket(this.url)

        this.signalingSocket.addEventListener('open', async () => {
            console.log(`ws opened`)
            this.ready = true

            this.signalingSocket.addEventListener('message', async message => {
                try {
                    let { type, data } = JSON.parse(message.data)

                    switch (type) {
                        case 'offer':
                            this.processOffer(data)
                            break

                        case 'confirmation':
                            this.processConfirmation(data)
                            break

                        case 'answer':
                            this.processAnswer(data)
                            break

                        case 'dataMessage':
                            let m: Messages.DataMessageDto = data
                            this.fakeSockets.has(m.offerId) && this.fakeSockets.get(m.offerId).broadcast('message', m.payload)
                            break

                        case 'close':
                            this.fakeSockets.has(data.offerId) && this.fakeSockets.get(data.offerId).close()
                            break
                    }
                }
                catch (error) {
                    console.log(`error processing message ${message} ${error}`)
                }
            })

            this.onReady()
        })

        this.signalingSocket.addEventListener('error', error => {
            console.log(`ws error ${error}`)
            for (let s of this.fakeSockets.values())
                s.broadcast('error', `fakesocket : ${error}`)
            this.signalingSocket.close()
        })

        this.signalingSocket.addEventListener('close', () => {
            console.log(`ws close`)
            for (let s of this.fakeSockets.values())
                s.close()
            this.signalingSocket = null

            setTimeout(() => this.createSignalingSocket(), 6000)
        })
    }

    offerChannel(message: string) {
        if (!this.ready) {
            console.log(`ERROR not ready to send offer !`)
            return null
        }

        return this.sendOffer(message)
    }

    private sendOffer(offerMessage: string) {
        try {
            let offerId = guid()

            console.log(`sending offer ${offerId}`)

            this.signalingSocket && this.signalingSocket.send(JSON.stringify({ type: 'offer', data: { offerId, offerMessage } }))

            return offerId
        }
        catch (error) {
            console.log(`error sending offer ${error}`)
            return null
        }
    }

    private async processAnswer(answer: Messages.AnswerDto) {
        console.log(`received answer ${JSON.stringify(answer)}`)

        if (this.fakeSockets.has(answer.offerId))
            return

        let fakeSocket = new FakeWebSocket(answer.offerId, this.signalingSocket)
        this.fakeSockets.set(answer.offerId, fakeSocket)

        this.onChannelOpened({ offerId: answer.offerId, counterPartyMessage: answer.answerMessage, isSelfInitiated: true }, fakeSocket)
    }

    private async processOffer(offer: Messages.OfferDto) {
        console.log(`received offer ${JSON.stringify(offer)}`)

        let acceptStatus = this.acceptOffer(offer.offerId, offer.offerMessage)
        if (!acceptStatus || !acceptStatus.accepted) {
            console.log(`not accepted offer ${JSON.stringify(offer)}`)
            return
        }

        await this.signalingSocket.send(JSON.stringify({ type: 'answer', data: { offerId: offer.offerId, answerMessage: acceptStatus.message } }))
    }

    private async processConfirmation(confirmation: Messages.ConfirmationDto) {
        console.log(`receive confirmation ${JSON.stringify(confirmation)}`)

        if (!confirmation.status) {
            console.log(`failed confirmation, aborting`)
            return
        }

        let fakeSocket = new FakeWebSocket(confirmation.offerId, this.signalingSocket)
        this.fakeSockets.set(confirmation.offerId, fakeSocket)

        this.onChannelOpened({ offerId: confirmation.offerId, counterPartyMessage: confirmation.offerMessage, isSelfInitiated: false }, fakeSocket)

        return
    }
}

class FakeWebSocket implements SocketAPI {
    constructor(private offerId: string, private signalingSocket: WebSocket) { }

    private listeners = new Map<string, { (event): void }[]>()

    on(eventType: string, listener: (data: any) => any) {
        if (eventType == 'open') {
            listener(undefined)
            return
        }

        if (this.listeners.has(eventType))
            this.listeners.get(eventType).push(listener)
        else
            this.listeners.set(eventType, [listener])
    }

    async send(data: string) {
        this.signalingSocket && await this.signalingSocket.send(JSON.stringify({ type: 'dataMessage', data: { offerId: this.offerId, payload: data } }))
    }

    close() {
        if (this.signalingSocket) {
            try {
                this.signalingSocket.send(JSON.stringify({ type: 'close', data: { offerId: this.offerId } }))
                this.signalingSocket = null
            }
            catch (e) {
                console.log(`error close ${e}`)
            }

            this.broadcast('close')
        }
    }

    broadcast(eventType: string, data?) {
        this.listeners.has(eventType) && this.listeners.get(eventType).forEach(h => h(data))
    }
}

function randomPart() {
    return Math.floor((1 + Math.random()) * 0x10000)
        .toString(16)
        .substring(1)
}

function guid() {
    return [1, 3, 2, 1, 2, 3, 4, 3, 2, 5].map(a => randomPart()).join('')
}