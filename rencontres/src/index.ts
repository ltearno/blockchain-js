import * as express from 'express'
import * as bodyParser from 'body-parser'
import * as http from 'http'
import * as https from 'https'
import * as fs from 'fs'

declare function ws(this: express.Server, url: string, callback: any)
declare function ws(this: express.Express, url: string, callback: any)

declare module "express" {
    interface Server {
        ws(url: string, callback: any)
    }

    interface Express {
        ws(url: string, callback: any)
    }
}

interface Offer {
    id: string
    offererMessage: string
    offererSocket: WebSocket

    answererMessage: string
    answererSocket: WebSocket

    registerTime?: number
}

interface Message {
    type: string
    data: any
}

class OffersIndex {
    private offers = new Map<string, Offer>()

    constructor() {
        setInterval(() => this.clearOldOffers(), 10 * 1000)
    }

    registerNewOffer(offer: Offer) {
        this.offers.set(offer.id, offer)
        offer.registerTime = Date.now()
    }

    get count() {
        return this.offers.size
    }

    findById(offerId) {
        return this.offers.get(offerId)
    }

    removeById(offerId): Offer {
        let offer = this.offers.get(offerId)
        if (!offer)
            return null

        this.offers.delete(offerId)

        return offer
    }

    forEachSocketOffers(ws: WebSocket, cb: (offer: Offer) => any) {
        this.offers.forEach(offer => {
            if (ws == offer.offererSocket || ws == offer.answererSocket)
                cb(offer)
        })
    }

    removeSocketOffers(ws: WebSocket) {
        let toBeRemoved = []
        for (let offer of this.offers.values())
            if (ws === offer.answererSocket || ws === offer.offererSocket)
                toBeRemoved.push(offer)

        toBeRemoved.forEach(offer => this.offers.delete(offer.id))
    }

    private clearOldOffers() {
        let timeoutTime = Date.now() - 15000

        let toBeRemoved = []
        for (let offer of this.offers.values())
            if ((!offer.offererSocket || !offer.answererSocket) && offer.registerTime <= timeoutTime)
                toBeRemoved.push(offer)

        toBeRemoved.forEach(offer => this.offers.delete(offer.id))

        if (toBeRemoved.length)
            console.log(`removed ${toBeRemoved.length} unused offers`)
    }
}

function createExpressApp(port: number) {
    let offers = new OffersIndex()
    let wss = new Set<WebSocket>()

    let app = express() as express.Express
    app.use(bodyParser.json())

    //http.createServer(app).listen(port, '0.0.0.0', () => console.log(`listening http on port ${port}`))
    let server = https.createServer({
        key: fs.readFileSync('key.pem'),
        cert: fs.readFileSync('cert.pem')
    }, app)

    require('express-ws')(app, server)

    server.listen(port, '0.0.0.0', () => console.log(`listening https on port ${port}`))

    app.use(function (req, res, next) {
        res.header("Access-Control-Allow-Origin", "*")
        res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept")
        next()
    })

    app.get('/test', async (req, res) => {
        res.send(JSON.stringify({ message: 'hello' }))
    })

    app.ws('/signal', (ws, req) => {
        wss.add(ws)

        console.log(`new ws ${wss.size}`)

        ws.on('message', raw => {
            let message = JSON.parse(raw) as Message

            switch (message.type) {
                case 'offer': {
                    let { offerId, offerMessage } = message.data

                    let offer: Offer = {
                        id: offerId,
                        offererMessage: offerMessage,
                        offererSocket: ws,
                        answererMessage: null,
                        answererSocket: null
                    }

                    offers.registerNewOffer(offer)
                    console.log(`offered channel, ${offers.count} left`)

                    let signalingPayload = JSON.stringify({ type: 'offer', data: { offerId: offer.id, offerMessage: offer.offererMessage } })
                    wss.forEach((info, peer) => peer != ws && send(peer, signalingPayload))
                } break

                case 'answer': {
                    let { offerId, answerMessage, sdp } = message.data

                    let offer = offers.findById(offerId)
                    if (!offer || offer.answererSocket) {
                        send(ws, JSON.stringify({ type: 'confirmation', data: { offerId, status: false } }))
                        break
                    }

                    // TODO give the offerer the possibility to decline the offer

                    offer.answererSocket = ws
                    offer.answererMessage = answerMessage

                    send(offer.offererSocket, JSON.stringify({ type: 'answer', data: { offerId, answerMessage } }))
                    send(offer.answererSocket, JSON.stringify({
                        type: 'confirmation', data: {
                            offerId,
                            status: true,
                            offerMessage: offer.offererMessage
                        }
                    }))
                } break

                case 'dataMessage': {
                    let { offerId, payload } = message.data

                    let offer = offers.findById(offerId)
                    if (!offer)
                        break

                    try {
                        let counterpartyWs = counterparty(ws, offer)
                        if (!counterpartyWs) {
                            console.log(`lost data message on offer ${offerId}: ${payload}`)
                            break
                        }

                        send(counterpartyWs, JSON.stringify({ type: 'dataMessage', data: { offerId, payload } }))
                    }
                    catch (error) {
                        console.log(`error proxying a dataMessage ${error}`)
                    }
                } break

                case 'close': {
                    let { offerId } = message.data

                    let offer = offers.removeById(offerId)
                    if (!offer)
                        break

                    console.log(`closed channel, ${offers.count} left`)

                    try {
                        let counterpartyWs = counterparty(ws, offer)
                        if (!counterpartyWs) {
                            console.log(`lost close message on offer ${offerId}`)
                            break
                        }

                        send(counterparty(ws, offer), JSON.stringify({ type: 'close', data: { offerId } }))
                    }
                    catch (error) {
                        console.log(`error proxying a close event ${error}`)
                    }
                } break
            }
        })

        ws.on('error', err => {
            console.log(`error on ws ${err}, closing`)

            ws.close()
        })

        ws.on('close', () => {
            offers.forEachSocketOffers(ws, offer => {
                send(counterparty(ws, offer), JSON.stringify({ type: 'close', data: { offerId: offer.id } }))
            })

            wss.delete(ws)

            offers.removeSocketOffers(ws)

            console.log(`closed ws, ws count:${wss.size}, offers count:${offers.count}`)
        })
    })

    return app
}

function counterparty(ws: WebSocket, offer: Offer) {
    if (ws === offer.offererSocket)
        return offer.answererSocket
    else if (ws == offer.answererSocket)
        return offer.offererSocket
    return null
}

function send(socket, payload) {
    try {
        socket && socket.readyState == 1 && socket.send(payload)
    }
    catch (error) {
        console.log(`error send message on socket ${error}`)
    }
}

createExpressApp(8999)