import * as express from 'express'
import * as bodyParser from 'body-parser'

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
    offererSdp: RTCSessionDescription
    offererCandidates: RTCIceCandidate[]

    answererSocket: WebSocket
    answererSdp: RTCSessionDescription
    answererCandidates: RTCIceCandidate[]
}

interface Message {
    type: string
    data: any
}

function createExpressApp(port: number) {
    let app = express() as express.Express

    let offers: Offer[] = []
    let wss = new Set<WebSocket>()

    require('express-ws')(app)
    app.use(bodyParser.json())

    app.listen(port, () => console.log(`listening http on port ${port}`))

    app.use(function (req, res, next) {
        res.header("Access-Control-Allow-Origin", "*")
        res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept")
        next()
    })

    app.ws('/signal', (ws, req) => {
        console.log(`new ws client`)
        wss.add(ws)

        ws.on('message', raw => {
            let message = JSON.parse(raw) as Message

            console.log(`message ${raw}`)

            switch (message.type) {
                case 'getOffersList':
                    // reply with the available offers list
                    break

                case 'offer': {
                    // add offer and signal to other peers
                    let { offerId, sdp, offerMessage } = message.data

                    let offer: Offer = {
                        id: offerId,
                        offererMessage: offerMessage,
                        offererSocket: ws,
                        offererSdp: sdp,
                        offererCandidates: [],
                        answererSocket: null,
                        answererSdp: null,
                        answererCandidates: []
                    }

                    offers.push(offer)

                    let signalingPayload = JSON.stringify({
                        type: 'offer', data: { offerId: offer.id, message: offer.offererMessage, sdp }
                    })
                    wss.forEach((info, peer) => peer != ws && peer.send(signalingPayload))
                    break
                }

                case 'answer':
                    let { offerId, sdp } = message.data

                    let offer = offers.find(o => o.id == offerId)
                    if (!offer || offer.answererSocket)
                        break

                    offer.answererSocket = ws
                    offer.answererSdp = sdp

                    // send missed candidates
                    offer.offererCandidates.forEach(candidate => {
                        offer.answererSocket.send(JSON.stringify({ type: 'candidate', data: { offerId: offer.id, candidate } }))
                    })

                    break

                case 'candidate': {
                    let { offerId, candidate } = message.data

                    let offer = offers.find(o => o.id == offerId)
                    if (!offer)
                        break

                    if (ws === offer.offererSocket) {
                        offer.offererCandidates.push(candidate)
                        offer.answererSocket && offer.answererSocket.send(JSON.stringify({ type: 'candidate', data: { offerId: offer.id, candidate } }))
                    }
                    else if (ws === offer.answererSocket) {
                        offer.answererCandidates.push(candidate)
                        offer.offererSocket && offer.offererSocket.send(JSON.stringify({ type: 'candidate', data: { offerId: offer.id, candidate } }))
                    }
                    else {
                        console.log(`lost candidate ${candidate} on offer ${offerId}`)
                    }
                } break
            }
        })

        ws.on('error', err => {
            console.log(`error on ws ${err}`)
            ws.close()
        })

        ws.on('close', () => {
            console.log(`closed ws`)
            wss.delete(ws)
            offers = offers.filter(o => ws === o.answererSocket || ws === o.offererSocket)
        })
    })

    return app
}

createExpressApp(8999)