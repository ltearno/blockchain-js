import * as express from 'express'
import * as bodyParser from 'body-parser'

export function createExpressApp(port: number) {
    let app = express()

    require('express-ws')(app)
    app.use(bodyParser.json())

    app.listen(port, () => console.log(`listening http on port ${port}`))

    return app
}