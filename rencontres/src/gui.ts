import * as Client from './client'

async function run() {
    window.onload = async () => {
        let nbChannels = 0

        let broker = new Client.PeerToPeerBrokering(`ws://${window.location.hostname}:8999/signal`,
            () => { },
            () => ({ accepted: true, message: 'hello!' }),
            (channelDescription, channel) => {
                console.log(`NEW CHANNEL ${JSON.stringify(channelDescription)}`)
                nbChannels++

                let i = 0

                channel.on('message', m => {
                    console.log(`rcv channel msg : ${m}`)
                })

                channel.on('close', () => {
                    console.log(`CLOSED`)

                    nbChannels--

                    if (nbChannels < 3)
                        broker.offerChannel("some offer by somebody")
                })

                let a = Math.floor(Math.random() * 100)
                let inte = null
                inte = setInterval(() => {
                    a--
                    channel.send(`${channelDescription.offerId}-${a}`)
                    if (a < 0) {
                        clearInterval(inte)
                        channel.close()
                    }
                }, 150)
            })

        broker.createSignalingSocket()

        let button = document.querySelector("#send-offer")
        button.addEventListener('click', async () => {
            let offerId = await broker.offerChannel("some offer by somebody")
        })
    }
}

run()