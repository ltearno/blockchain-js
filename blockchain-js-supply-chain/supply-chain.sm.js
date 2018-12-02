/**
 * This is a Supply Chain smart contract implementation
 * 
 * Users are registered.
 * 
 * Identity is provided by the 'identity-registry-1' contract
 * 
 * TODO:
 * 
 * celui qui a gagné le plus d'emotijis
 * in participations, add also the count of artworks
 * stats by user : # consumed pixels/emojis, # earned pixels/emojis, # consumed other's artworks, # validated artworks, # used artwork by others
 * stats by artwork : # of reuse (by other author), # total apparitions
 */
((() => {
    const MAX_GRID_SIZE = 100

    const LIMIT_WINNED_COUNT = 1000
    const ACCOUNT_CREATION_NB_PIXELS_PACKETS = 4
    const ACCOUNT_CREATION_NB_PIXEL_PER_PACKET = 21
    const ACCOUNT_CREATION_NB_REDISTRIBUTABLE_ITEMS = 2
    const PARTICIPATION_REDITRIBUTABLE_RATIO = 13
    const PARTICIPATION_NB_PIXEL_PER_PACKET = 5

    const COLOR_COMPONENTS = [0, 84, 138, 192, 255]
    const randomColorComponent = randomFunction => COLOR_COMPONENTS[randomFunction(COLOR_COMPONENTS.length)]
    const randomColor = (randomFunction) => {
        return `rgb(${randomColorComponent(randomFunction)},${randomColorComponent(randomFunction)},${randomColorComponent(randomFunction)})`
    }

    // grid cells :
    // - pixels & emojis : for the author
    // - artworks : add participations
    const processArtWorkParticipations = (data, artWork) => {
        const participations = {}

        Object.values(artWork.grid).forEach(workItemId => {
            if (workItemId.startsWith('artwork-')) {
                const participedArtWork = data.artWorks[workItemId.substr('artwork-'.length)]
                // count 1 for the artwork
                if (!participations[participedArtWork.author])
                    participations[participedArtWork.author] = 0
                participations[participedArtWork.author]++

                // and add the sub artwork participations
                for (let author in participedArtWork.participations) {
                    if (!participations[author])
                        participations[author] = 0
                    participations[author] += participedArtWork.participations[author]
                }
            }
            else { //if (workItemId.startsWith('pixel-') || workItemId.startsWith('emoji-')) {
                if (!participations[artWork.author])
                    participations[artWork.author] = 0
                participations[artWork.author]++
            }
        })

        artWork.participations = participations
    }

    const containsArtWorkId = (data, searchedArtWorkId, workItemId, acceptedArtworks) => {
        if (!workItemId)
            return false

        if (!workItemId.startsWith('artwork-'))
            return false

        let artWorkId = workItemId.substr('artwork-'.length)

        if (artWorkId == searchedArtWorkId)
            return true

        if (artWorkId in acceptedArtworks)
            return false

        artWork = data.artWorks[artWorkId]
        if (!artWork)
            return false

        if (!artWork.grid)
            return false

        let subIds = {}
        Object.values(artWork.grid).forEach(workItemId => subIds[workItemId] = true)
        if (Object.keys(subIds).some(workItemId => containsArtWorkId(data, searchedArtWorkId, workItemId, acceptedArtworks)))
            return true

        acceptedArtworks[artWorkId] = true
        return false
    }

    return {
        /**
         */
        init: function () {
            this.data.redistributableItems = [
                "😀", "😃", "😄", "😁", "😆", "😅", "🤣", "😂", "🙂", "🙃", "😉", "😊", "😇", "😍", "🤩",
                "😘", "😗", "☺", "😚", "😙", "😋", "😛", "😜", "🤪", "😝", "🤑", "🤗", "🤭", "🤫", "🤔",
                "🤐", "🤨", "😐", "😑", "😶", "😏", "😒", "🙄", "😬", "🤥", "😌", "😔", "😪", "🤤", "😴",
                "😷", "🤒", "🤕", "🤢", "🤮", "🤧", "😵", "🤯", "🤠", "😎", "🤓", "🧐", "😕", "😟", "🙁",
                "☹", "😮", "😯", "😲", "😳", "😦", "😧", "😨", "😰", "😥", "😢", "😭", "😱", "😖", "😣",
                "😞", "😓", "😩", "😫", "😤", "😡", "😠", "🤬", "😈", "👿", "💀", "☠", "💩", "🤡", "👹",
                "👺", "👻", "👽", "👾", "🤖", "😺", "😸", "😹", "😻", "😼", "😽", "🙀", "😿", "😾", "🙈",
                "🙉", "🙊", "💋", "💌", "💘", "💝", "💖", "💗", "💓", "💞", "💕", "💟", "❣", "💔", "❤",
                "🧡", "💛", "💚", "💙", "💜", "🖤", "💯", "💢", "💥", "💫", "💦", "💨", "🕳", "💣", "💬",
                "👁️‍🗨️", "🗨", "🗯", "💭", "💤", "👋", "🤚", "🖐", "✋", "🖖", "👌", "✌", "🤞", "🤟", "🤘",
                "🤙", "👈", "👉", "👆", "🖕", "👇", "☝", "👍", "👎", "✊", "👊", "🤛", "🤜", "👏", "🙌",
                "👐", "🤲", "🤝", "🙏", "✍", "💅", "🤳", "💪", "👂", "👃", "🧠", "👀", "👁", "👅", "👄",
                "👶", "🧒", "👦", "👧", "🧑", "👱", "👨", "🧔", "👩", "🧓", "👴", "👵", "🙍", "🙎", "🙅",
                "🙆", "🙆‍♂️", "💁", "🙋", "🙇", "🤦", "🤷", "👷", "🤴", "👸", "👳", "👲", "🧕", "🤵",
                "👰", "🤰", "🤱", "👼", "🎅", "🤶", "🧙", "🧚", "🧛", "🧜", "🧝", "🧞", "🧞‍♂️", "🧞‍♀️", "🧟",
                "🧟‍♂️", "🧟‍♀️", "💆", "💆‍♂️", "💆‍♀️", "💇", "💇‍♂️", "💇‍♀️", "🚶", "🚶‍♂️", "🚶‍♀️", "🏃", "🏃‍♂️",
                "🏃‍♀️", "💃", "🕺", "🕴", "👯", "👯‍♂️", "👯‍♀️", "🧖", "🧖‍♂️", "🧖‍♀️", "🧗", "🧗‍♂️", "🧗‍♀️",
                "🤺", "🏇", "⛷", "🏂", "🏌", "🏌️‍♂️", "🏌️‍♀️", "🏄", "🏄‍♂️", "🏄‍♀️", "🚣", "🚣‍♂️", "🚣‍♀️",
                "🏊", "🏊‍♂️", "🏊‍♀️", "⛹", "⛹️‍♂️", "⛹️‍♀️", "🏋", "🏋️‍♂️", "🏋️‍♀️", "🚴", "🚴‍♂️", "🚴‍♀️",
                "🚵", "🚵‍♂️", "🚵‍♀️", "🤸", "🤸‍♂️", "🤸‍♀️", "🤼", "🤼‍♂️", "🤼‍♀️", "🤽", "🤽‍♂️", "🤽‍♀️", "🤾",
                "🤾‍♂️", "🤾‍♀️", "🤹", "🤹‍♂️", "🤹‍♀️", "🧘", "🛀", "🛌", "👭", "👫", "👬", "💏", "💑", "👪",
                "🗣", "👤", "👥", "👣", "🐵", "🐒", "🦍", "🐶", "🐕", "🐩", "🐺", "🦊", "🐱", "🐈", "🦁",
                "🐯", "🐅", "🐆", "🐴", "🐎", "🦄", "🦓", "🦌", "🐮", "🐂", "🐃", "🐄", "🐷", "🐖", "🐗",
                "🐽", "🐏", "🐑", "🐐", "🐪", "🐫", "🦒", "🐘", "🦏", "🐭", "🐁", "🐀", "🐹", "🐰", "🐇",
                "🐿", "🦔", "🦇", "🐻", "🐨", "🐼", "🐾", "🦃", "🐔", "🐓", "🐣", "🐤", "🐥", "🐦", "🐧",
                "🕊", "🦅", "🦆", "🦉", "🐸", "🐊", "🐢", "🦎", "🐍", "🐲", "🐉", "🦕", "🦖", "🐳", "🐋",
                "🐬", "🐟", "🐠", "🐡", "🦈", "🐙", "🐚", "🐌", "🦋", "🐛", "🐜", "🐝", "🐞", "🦗", "🕷",
                "🕸", "🦂", "💐", "🌸", "💮", "🏵", "🌹", "🥀", "🌺", "🌻", "🌼", "🌷", "🌱", "🌲", "🌳", "🌴",
                "🌵", "🌾", "🌿", "☘", "🍀", "🍁", "🍂", "🍃", "🍇", "🍈", "🍉", "🍊", "🍋", "🍌", "🍍", "🍎",
                "🍏", "🍐", "🍑", "🍒", "🍓", "🥝", "🍅", "🥥", "🥑", "🍆", "🥔", "🥕", "🌽", "🌶", "🥒", "🥦",
                "🍄", "🥜", "🌰", "🍞", "🥐", "🥖", "🥨", "🥞", "🧀", "🍖", "🍗", "🥩", "🥓", "🍔", "🍟",
                "🍕", "🌭", "🥪", "🌮", "🌯", "🥙", "🥚", "🍳", "🥘", "🍲", "🥣", "🥗", "🍿", "🥫", "🍱",
                "🍘", "🍙", "🍚", "🍛", "🍜", "🍝", "🍠", "🍢", "🍣", "🍤", "🍥", "🍡", "🥟", "🥠", "🥡",
                "🦀", "🦐", "🦑", "🍦", "🍧", "🍨", "🍩", "🍪", "🎂", "🍰", "🥧", "🍫", "🍬", "🍭", "🍮", "🍯",
                "🍼", "🥛", "☕", "🍵", "🍶", "🍾", "🍷", "🍸", "🍹", "🍺", "🍻", "🥂", "🥃", "🥤", "🥢", "🍽",
                "🍴", "🥄", "🔪", "🏺", "🌍", "🌎", "🌏", "🌐", "🗺", "🗾", "🏔", "⛰", "🌋", "🗻", "🏕",
                "🏖", "🏜", "🏝", "🏞", "🏟", "🏛", "🏗", "🏘", "🏚", "🏠", "🏡", "🏢", "🏣", "🏤", "🏥", "🏦",
                "🏨", "🏩", "🏪", "🏫", "🏬", "🏭", "🏯", "🏰", "💒", "🗼", "🗽", "⛪", "🕌", "🕍", "⛩", "🕋",
                "⛲", "⛺", "🌁", "🌃", "🏙", "🌄", "🌅", "🌆", "🌇", "🌉", "♨", "🌌", "🎠", "🎡", "🎢", "💈",
                "🎪", "🚂", "🚃", "🚄", "🚅", "🚆", "🚇", "🚈", "🚉", "🚊", "🚝", "🚞", "🚋", "🚌", "🚍", "🚎",
                "🚐", "🚑", "🚒", "🚓", "🚔", "🚕", "🚖", "🚗", "🚘", "🚙", "🚚", "🚛", "🚜", "🏎", "🏍", "🛵",
                "🚲", "🛴", "🚏", "🛣", "🛤", "🛢", "⛽", "🚨", "🚥", "🚦", "🛑", "🚧", "⚓", "⛵", "🛶", "🚤",
                "🛳", "⛴", "🛥", "🚢", "✈", "🛩", "🛫", "🛬", "💺", "🚁", "🚟", "🚠", "🚡", "🛰", "🚀",
                "🛸", "🛎", "⌛", "⏳", "⌚", "⏰", "⏱", "⏲", "🕰", "🕛", "🕧", "🕐", "🕜", "🕑", "🕝", "🕒",
                "🕞", "🕓", "🕟", "🕔", "🕠", "🕕", "🕡", "🕖", "🕢", "🕗", "🕣", "🕘", "🕤", "🕙", "🕥", "🕚",
                "🕦", "🌑", "🌒", "🌓", "🌔", "🌕", "🌖", "🌗", "🌘", "🌙", "🌚", "🌛", "🌜", "🌡", "☀", "🌝",
                "🌞", "⭐", "🌟", "🌠", "☁", "⛅", "⛈", "🌤", "🌥", "🌦", "🌧", "🌨", "🌩", "🌪", "🌫", "🌬",
                "🌀", "🌈", "🌂", "☂", "☔", "⛱", "⚡", "❄", "☃", "⛄", "☄", "🔥", "💧", "🌊", "🎃", "🎄",
                "🎆", "🎇", "✨", "🎈", "🎉", "🎊", "🎋", "🎍", "🎎", "🎏", "🎐", "🎑", "🎀", "🎁", "🎗",
                "🎟", "🎫", "🎖", "🏆", "🏅", "🥇", "🥈", "🥉", "⚽", "⚾", "🏀", "🏐", "🏈", "🏉", "🎾",
                "🎳", "🏏", "🏑", "🏒", "🏓", "🏸", "🥊", "🥋", "🥅", "⛳", "⛸", "🎣", "🎽", "🎿", "🛷",
                "🥌", "🎯", "🎱", "🔮", "🎮", "🕹", "🎰", "🎲", "♠", "♥", "♦", "♣", "♟", "🃏", "🀄", "🎴",
                "🎭", "🖼", "🎨", "👓", "🕶", "👔", "👕", "👖", "🧣", "🧤", "🧥", "🧦", "👗", "👘", "👙",
                "👚", "👛", "👜", "👝", "🛍", "🎒", "👞", "👟", "👠", "👡", "👢", "👑", "👒", "🎩", "🎓",
                "🧢", "⛑", "📿", "💄", "💍", "💎", "🔇", "🔈", "🔉", "🔊", "📢", "📣", "📯", "🔔", "🔕",
                "🎼", "🎵", "🎶", "🎙", "🎚", "🎛", "🎤", "🎧", "📻", "🎷", "🎸", "🎹", "🎺", "🎻", "🥁",
                "📱", "📲", "☎", "📞", "📟", "📠", "🔋", "🔌", "💻", "🖥", "🖨", "⌨", "🖱", "🖲", "💽",
                "💾", "💿", "📀", "🎥", "🎞", "📽", "🎬", "📺", "📷", "📸", "📹", "📼", "🔍", "🔎", "🕯",
                "💡", "🔦", "🏮", "📔", "📕", "📖", "📗", "📘", "📙", "📚", "📓", "📒", "📃", "📜", "📄",
                "📰", "🗞", "📑", "🔖", "🏷", "💰", "💴", "💵", "💶", "💷", "💸", "💳", "💹", "💱", "💲",
                "✉", "📧", "📨", "📩", "📤", "📥", "📦", "📫", "📪", "📬", "📭", "📮", "🗳", "✏", "✒",
                "🖋", "🖊", "🖌", "🖍", "📝", "💼", "📁", "📂", "🗂", "📅", "📆", "🗒", "🗓", "📇", "📈",
                "📉", "📊", "📋", "📌", "📍", "📎", "🖇", "📏", "📐", "✂", "🗃", "🗄", "🗑", "🔒", "🔓",
                "🔏", "🔐", "🔑", "🗝", "🔨", "⛏", "⚒", "🛠", "🗡", "⚔", "🔫", "🏹", "🛡", "🔧", "🔩",
                "⚙", "🗜", "⚖", "🔗", "⛓", "⚗", "🔬", "🔭", "📡", "💉", "💊", "🚪", "🛏", "🛋", "🚽",
                "🚿", "🛁", "🛒", "🚬", "⚰", "⚱", "🗿", "🏧", "🚮", "🚰", "♿", "🚹", "🚺", "🚻", "🚼", "🚾",
                "🛂", "🛃", "🛄", "🛅", "⚠", "🚸", "⛔", "🚫", "🚳", "🚭", "🚯", "🚱", "🚷", "📵", "🔞",
                "☢", "☣", "⬆", "↗", "➡", "↘", "⬇", "↙", "⬅", "↖", "↕", "↔", "↩", "↪", "⤴", "⤵",
                "🔃", "🔄", "🔙", "🔚", "🔛", "🔜", "🔝", "🛐", "⚛", "🕉", "✡", "☸", "☯", "✝", "☦", "☪",
                "☮", "🕎", "🔯", "♈", "♉", "♊", "♋", "♌", "♍", "♎", "♏", "♐", "♑", "♒", "♓", "⛎", "🔀",
                "🔁", "🔂", "▶", "⏩", "⏭", "⏯", "◀", "⏪", "⏮", "🔼", "⏫", "🔽", "⏬", "⏸", "⏹", "⏺",
                "⏏", "🎦", "🔅", "🔆", "📶", "📳", "📴", "♀", "♂", "⚕", "♾", "♻", "⚜", "🔱", "📛", "🔰", "⭕",
                "✅", "☑", "✔", "✖", "❌", "❎", "➕", "➖", "➗", "➰", "➿", "〽", "✳", "✴", "❇", "‼", "⁉",
                "❓", "❔", "❕", "❗", "〰", "©", "®", "™", "#️⃣", "*️⃣", "0️⃣", "1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣",
                "8️⃣", "9️⃣", "🔟", "🅰", "🆎", "🅱", "🆑", "🆒", "🆓", "ℹ", "🆔", "Ⓜ", "🆕", "🆖", "🅾", "🆗",
                "🅿", "🆘", "🆙", "🆚", "🈁", "🈂", "🈷", "🈶", "🈯", "🉐", "🈹", "🈚", "🈲", "🉑", "🈸", "🈴",
                "🈳", "㊗", "㊙", "🈺", "🈵", "🔴", "🔵", "⚪", "⚫", "⬜", "⬛", "◼", "◻", "◽", "◾", "▫", "▪",
                "🔶", "🔷", "🔸", "🔹", "🔺", "🔻", "💠", "🔘", "🔲", "🔳", "🏁", "🚩", "🎌", "🏴", "🏳", "🏳️‍🌈", "🏴‍☠️"]

            this.data.accounts = {}

            this.data.artWorks = {}
        },

        /** 
        * @param data { id }, signed by the id's public key on identity smart contract
         */
        createAccount: function (args) {
            console.log(`creating account...`)

            let signInData = callContract('identity-registry-1', 0, 'signIn', args)
            if (!signInData || !signInData.id) {
                console.log(`signIn failed`)
                return null
            }

            let id = signInData.id

            if (this.data.accounts[id]) {
                console.log(`already exists account for ${id}`)
                return null
            }

            let random = (modulo) => {
                let randomString = callContract('random-generator-v1', 0, 'generate', args)
                let result = parseInt(randomString.substr(0, 8), 16)
                return result % modulo
            }

            let items = {}

            // give pixels
            for (let i = 0; i < ACCOUNT_CREATION_NB_PIXELS_PACKETS; i++) {
                let item = `pixel-${randomColor(random)}`
                if (item in items)
                    items[item] += ACCOUNT_CREATION_NB_PIXEL_PER_PACKET
                else
                    items[item] = ACCOUNT_CREATION_NB_PIXEL_PER_PACKET
            }

            // give redistributable items
            for (let i = 0; i < ACCOUNT_CREATION_NB_REDISTRIBUTABLE_ITEMS; i++) {
                let item = 'emoji-' + this.data.redistributableItems[random(this.data.redistributableItems.length)]
                if (item in items)
                    items[item] += 1
                else
                    items[item] = 1
            }

            this.data.accounts[id] = {
                id,
                inventory: items,
                nbConsumedPixels: 0,
                nbConsumedEmojis: 0,
                nbConsumedArtWorks: 0,
                nbWinnedPixels: 0,
                nbWinnedEmojis: 0
            }

            console.log(`account ${this.data.accounts[id]} registered!`)

            return this.data.accounts[id]
        },

        hasAccount: function (args) {
            if (!lib.checkStringArgs(args, ['id']))
                return false

            return args.id in this.data.accounts
        },




        registerArtWork: function (args) {
            if (!lib.checkArgs(args, ['artWork'])) {
                console.log(`missing artWork argument`)
                return false
            }

            let artWork = args['artWork']

            if (this.data.artWorks[artWork.id]) {
                console.log(`artwork ${artWork.id} already exists`)
                return false
            }

            if (artWork.size.height <= 0)
                artWork.size.height = 1
            if (artWork.size.height > MAX_GRID_SIZE)
                artWork.size.height = MAX_GRID_SIZE
            if (artWork.size.width <= 0)
                artWork.size.width = 1
            if (artWork.size.width > MAX_GRID_SIZE)
                artWork.size.width = MAX_GRID_SIZE

            artWork.grid = {}

            // TODO sanity check

            this.data.artWorks[artWork.id] = artWork
            this.data.artWorks[artWork.id].serialNumber = Object.keys(this.data.artWorks).length

            return true
        },



        validateArtWork: function (args) {
            if (!lib.checkArgs(args, ['artWorkId'])) {
                console.log(`missing artWorkId argument`)
                return false
            }

            let artWorkId = args['artWorkId']

            let artWork = this.data.artWorks[artWorkId]
            if (!artWork)
                return false

            let canValidate = () => {
                if (!artWork.grid)
                    return false

                return !Object.values(artWork.grid)
                    .filter(workItemId => workItemId.startsWith('artwork-'))
                    .map(workItemId => workItemId.substr('artwork-'.length))
                    .some(artWorkId => !this.data.artWorks[artWorkId].validated)
            }

            if (!canValidate()) {
                console.log(`cannot validate artwork because not all artworks are validated`)
                return false
            }

            artWork.validated = true

            processArtWorkParticipations(this.data, artWork)

            let seed = callContract('random-generator-v1', 0, 'generate', args)
            let seedIndex = 0

            let random = (modulo) => {
                let result = parseInt(seed.substr(seedIndex, 4), 16)

                seedIndex += 4

                if (seedIndex > seed.length - 4) {
                    seed = lib.hash(seed) // gives 64 digits
                    seedIndex = 0
                }

                return result % modulo
            }

            for (let userId in artWork.participations) {
                let count = artWork.participations[userId]

                // special case for the artwork author : we only count current artwork pixels and emojis
                if (userId == artWork.author) {
                    count = Object.values(artWork.grid)
                        .filter(workItemId => workItemId.startsWith('pixel-') || workItemId.startsWith('emoji-'))
                        .length
                } else if (count > LIMIT_WINNED_COUNT) {
                    // HARDCODED retribution limit
                    // TODO : reditribute that to the ecology tax
                    count = LIMIT_WINNED_COUNT
                }

                while (count) {
                    let winnedItemId
                    let winnedCount
                    if (count % PARTICIPATION_REDITRIBUTABLE_RATIO == (PARTICIPATION_REDITRIBUTABLE_RATIO - 1)) {
                        winnedItemId = 'emoji-' + this.data.redistributableItems[random(this.data.redistributableItems.length)]
                        winnedCount = 1
                        this.data.accounts[userId].nbWinnedEmojis += winnedCount
                    }
                    else {
                        winnedItemId = `pixel-${randomColor(random)}`
                        winnedCount = count >= PARTICIPATION_NB_PIXEL_PER_PACKET ? PARTICIPATION_NB_PIXEL_PER_PACKET : count
                        this.data.accounts[userId].nbWinnedPixels += winnedCount
                    }

                    let inventory = this.data.accounts[userId].inventory
                    if (!inventory[winnedItemId])
                        inventory[winnedItemId] = winnedCount
                    else
                        inventory[winnedItemId] += winnedCount

                    count -= winnedCount
                }
            }

            Object.values(artWork.grid).forEach(workItemId => {
                if (workItemId.startsWith('pixel-')) {
                    this.data.accounts[artWork.author].nbConsumedPixels++
                }
                else if (workItemId.startsWith('emoji-')) {
                    this.data.accounts[artWork.author].nbConsumedEmojis++
                }
                else if (workItemId.startsWith('artwork-')) {
                    this.data.accounts[artWork.author].nbConsumedArtWorks++
                }
            })
        },


        removeCellFromArtWork: function (args) {
            if (!lib.checkArgs(args, ['artWorkId', 'x', 'y']))
                return false

            let artWorkId = args['artWorkId']
            let x = args['x']
            let y = args['y']

            const artWork = this.data.artWorks[artWorkId]
            if (!artWork)
                return false

            let coordIndex = `${x + artWork.size.width * y}`
            if (!artWork.grid[coordIndex])
                return true

            let itemId = artWork.grid[coordIndex]

            delete artWork.grid[coordIndex]

            if (itemId != null && (itemId.startsWith('pixel-') || itemId.startsWith('emoji-'))) {
                if (!this.data.accounts[artWork.author].inventory[itemId])
                    this.data.accounts[artWork.author].inventory[itemId] = 0
                this.data.accounts[artWork.author].inventory[itemId]++
            }

            return true
        },


        addItemInArtWorkFromInventory: function (args) {
            if (!lib.checkArgs(args, ['artWorkId', 'itemId', 'x', 'y']))
                return false

            let artWorkId = args['artWorkId']
            let itemId = args['itemId']
            let x = args['x']
            let y = args['y']

            const artWork = this.data.artWorks[artWorkId]
            if (!artWork)
                return false

            if (itemId.startsWith('pixel-') || itemId.startsWith('emoji-')) {
                if (this.data.accounts[artWork.author].inventory[itemId] > 0) {
                    this.data.accounts[artWork.author].inventory[itemId]--
                    if (this.data.accounts[artWork.author].inventory[itemId] == 0)
                        delete this.data.accounts[artWork.author].inventory[itemId]
                }
                else {
                    return false
                }
            }
            else {
                if (containsArtWorkId(this.data, artWorkId, itemId, {})) {
                    console.log(`cannot add this artwork has it would produce a cycle !`)
                    return false
                }
            }

            let coordIndex = `${x + artWork.size.width * y}`
            artWork.grid[coordIndex] = itemId

            return true
        },

        sendMessageOnArtWork: function (args) {
            if (!lib.checkArgs(args, ['userId', 'artWorkId', 'text']))
                return false

            let userId = args['userId']
            let artWorkId = args['artWorkId']
            let text = args['text']

            this.data.artWorks[artWorkId].messages.push({ author: userId, text })

            return true
        },



        updateArtWorkTitle: function (args) {
            if (!lib.checkArgs(args, ['artWorkId', 'title']))
                return false

            let artWorkId = args['artWorkId']
            let title = args['title']

            const artWork = this.data.artWorks[artWorkId]
            if (!artWork)
                return false

            artWork.title = title

            return true
        },



        updateArtWorkSize: function (args) {
            if (!lib.checkArgs(args, ['artWorkId', 'width', 'height']))
                return false

            let artWorkId = args['artWorkId']
            let width = args['width']
            let height = args['height']

            if (width <= 0)
                width = 1
            if (width > MAX_GRID_SIZE)
                width = MAX_GRID_SIZE
            if (height <= 0)
                height = 1
            if (height > MAX_GRID_SIZE)
                height = MAX_GRID_SIZE

            const artWork = this.data.artWorks[artWorkId]
            if (!artWork)
                return false

            artWork.size.width = width
            artWork.size.height = height

            return true
        }
    }
})())