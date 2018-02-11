import * as Messages from './messages'

// TODO => implement that
interface PeerConnectionContext {
    peerConnection: RTCPeerConnection
    dataChannel: RTCDataChannel
    offerId: string
    offerSent: RTCSessionDescriptionInit
    answerSent: RTCSessionDescriptionInit
    iceCandidatesSent: RTCIceCandidate[]
    iceCandidatesReceived: RTCIceCandidate[]
}

async function sendOffer(offerMessage: string, signalingSocket: WebSocket) {
    try {
        offerId = guid()

        let { peerConnection, dataChannel } = await createPeerConnection(signalingSocket)

        let sdp = await peerConnection.createOffer({ offerToReceiveAudio: 0, offerToReceiveVideo: 0 })
        await peerConnection.setLocalDescription(sdp)

        console.log(`sending offer ${offerId}`)
        signalingSocket.send(JSON.stringify({ type: 'offer', data: { offerId, offerMessage, sdp } }))

        return peerConnection
    }
    catch (error) {
        console.log(`error sending offer ${error}`)
    }
}

async function processOffer(offer: Messages.OfferDto, signalingSocket) {
    console.log(`received offer ${JSON.stringify(offer)}`)

    offerId = offer.offerId

    let info = await createPeerConnection(signalingSocket)
    peerConnection = info.peerConnection
    dataChannel = info.dataChannel

    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer.sdp))

    let sdpConstraints = {
        mandatory: {
            OfferToReceiveAudio: false,
            OfferToReceiveVideo: false
        }
    }

    let sdp = await peerConnection.createAnswer(sdpConstraints as RTCAnswerOptions)
    await peerConnection.setLocalDescription(sdp)

    console.log(`sending answer to ${offer.offerId}`)
    await signalingSocket.send(JSON.stringify({ type: 'answer', data: { offerId: offer.offerId, sdp } }))

    //dataChannel = peerConnection.createDataChannel("sendDataChannel", { reliable: true } as RTCDataChannelInit)
}

async function processAnswer(answer: Messages.AnswerDto, peerConnection) {
    console.log(`received answer ${JSON.stringify(answer)}`)

    await peerConnection.setRemoteDescription(new RTCSessionDescription(answer.sdp))

    console.log(`remote description done, data channel should establish`)

    //dataChannel = peerConnection.createDataChannel("sendDataChannel", { reliable: true } as RTCDataChannelInit)
}

async function processIceCandidate(candidate: RTCIceCandidateInit, peerConnection: RTCPeerConnection) {
    console.log(`adding ice candidate ${JSON.stringify(candidate)}`)

    try {
        let c = new RTCIceCandidate(candidate)
        await peerConnection.addIceCandidate(c)
    } catch (e) {
        console.log(`error candidate ${e}`)
    }
}

async function createPeerConnection(signalingSocket: WebSocket) {
    let config = { "iceServers": [{ "url": "stun:stun.l.google.com:19302" }] }
    let peerConnection = new RTCPeerConnection(config as RTCConfiguration)

    peerConnection.onicecandidate = (event) => {
        if (!peerConnection || !event || !event.candidate) {
            console.log(`ERROR unknown candidate`)
            return
        }

        console.log(`onicecandidate: ${JSON.stringify(event)}`)
        signalingSocket.send(JSON.stringify({ type: 'candidate', data: { offerId, candidate: event.candidate } }))
    }

    peerConnection.ondatachannel = (event) => {
        console.log('ondatachannel')
        //handleDataChannel(`causal data channel`, event.channel)
    }

    //console.log(`creating rtc data channel`)
    dataChannel = peerConnection.createDataChannel("sendDataChannel", { reliable: true } as RTCDataChannelInit)
    handleDataChannel(`initial data channel`, dataChannel)

    return { peerConnection, dataChannel }
}

let offerId: string = null
let peerConnection: RTCPeerConnection = null
let dataChannel: RTCDataChannel = null

function initializeSignaling(): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
        let endpoint = `ws://localhost:8999/signal`

        let socket = new WebSocket(endpoint)

        socket.addEventListener('open', async () => {
            console.log(`ws open, you can create a peer connection`)

            socket.addEventListener('message', async message => {
                // TODO avoir ici quelque chose pour router le message à la bonne connection
                console.log(`ws rcv message ${message.data} ${peerConnection}`)

                try {
                    let { type, data } = JSON.parse(message.data)

                    switch (type) {
                        case 'candidate': peerConnection && processIceCandidate(data.candidate, peerConnection); break
                        case 'offer': processOffer(data, socket); break
                        case 'answer': peerConnection && processAnswer(data, peerConnection); break
                    }
                }
                catch (error) {
                    console.log(`error processing message ${message} ${error}`)
                }
            })

            resolve(socket)
        })

        socket.addEventListener('error', error => {
            console.log(`ws error ${error}`)
            socket.close()
        })

        socket.addEventListener('close', () => {
            console.log(`ws close`)

            reject(socket)
        })
    })
}

function handleDataChannel(name, channel) {
    channel.onopen = () => {
        console.log(`[${name}] opened`)

        setInterval(() => channel.send(JSON.stringify({ type: 'hello in RTC !' })), 1000)
    }
    channel.onmessage = event => console.log(`[${name}] receive message: ${event.data}`)
    channel.onclose = () => console.log(`[${name}] closed`)
    channel.onerror = error => console.log(`[${name}] error ${error}`)
}

function randomPart() {
    return Math.floor((1 + Math.random()) * 0x10000)
        .toString(16)
        .substring(1)
}

function guid() {
    return [1, 3, 2, 1, 2, 3, 4, 5].map(a => randomPart()).join('')
}

async function run() {
    window.onload = async () => {
        let signalingSocket = await initializeSignaling()

        let button = document.querySelector("#send-offer")

        button.addEventListener('click', async () => {
            if (peerConnection) {
                peerConnection.close()
                peerConnection = null
            }

            peerConnection = await sendOffer("some offer by somebody", signalingSocket)
        })
    }
}

run()