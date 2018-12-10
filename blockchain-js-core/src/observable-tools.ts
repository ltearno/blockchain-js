import * as RxJs from 'rxjs'

export class Emitter<T> extends RxJs.Observable<T> {
    private subscriber: RxJs.Subscriber<T>

    constructor() {
        super(subscriber => this.subscriber = subscriber)
    }

    emit(value: T) {
        this.subscriber.next(value)
    }

    error(error) {
        this.subscriber.error(error)
    }

    finish() {
        this.subscriber.complete()
    }
}
