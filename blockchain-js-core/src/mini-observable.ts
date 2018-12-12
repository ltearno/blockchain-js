const IS_DEBUG = false

import * as TestTools from './test-tools'

export interface EventReceiver<T> {
    // if returns a promise, the promise will be waited for
    (value: T): Promise<any>
}

export interface Subscription {
}

export interface EventSource<T> {
    subscribe(callback: EventReceiver<T>): Subscription
}

export class SimpleEventEmitter<T> implements EventSource<T> {
    private callback: EventReceiver<T>

    private processing: boolean = false
    private rcvCounter = 0
    private lastValue: T = null

    emit(value: T) {
        if (!this.callback)
            return

        this.rcvCounter++
        this.lastValue = value

        this.process()
    }

    subscribe(callback: EventReceiver<T>): Subscription {
        this.callback = callback
        return this.callback
    }

    private async process() {
        if (this.processing) {
            //IS_DEBUG && console.log(`already processing, queued call...`)
            return
        }

        this.processing = true
        let initialRcvCounter = this.rcvCounter

        IS_DEBUG && console.log(`start event processing ${initialRcvCounter} ${this.callback}`)

        try {
            let value = this.lastValue
            await this.callback(value)
            await TestTools.wait(0)
        }
        catch (error) {
            console.error(`error scheduling an event receiver`, error)
        }

        IS_DEBUG && console.log(`finished event processing ${initialRcvCounter} / ${this.rcvCounter} ${this.callback}`)

        if (this.rcvCounter != initialRcvCounter) {
            //await TestTools.wait(1)
            this.processing = false
            this.process()
        }
        else {
            this.processing = false
        }
    }
}