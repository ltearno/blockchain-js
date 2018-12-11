import { Operator, Observable, Subscriber, Subscription, MonoTypeOperatorFunction, SchedulerLike, TeardownLogic, asyncScheduler } from 'rxjs'

/**
 * Like debounce but fires immediately the first time
 *
 * @see {@link debounce}
 * @see {@link debounceTime}
 *
 * @param {number} dueTime The timeout duration in milliseconds (or the time
 * unit determined internally by the optional `scheduler`) for the window of
 * time required to wait for emission silence before emitting the most recent
 * source value.
 * @param {SchedulerLike} [scheduler=asyncScheduler] The {@link SchedulerLike} to use for
 * managing the timers that handle the timeout for each value.
 * @return {Observable} An Observable that delays the emissions of the source
 * Observable by the specified `dueTime`, and may drop some values if they occur
 * too frequently.
 * @method debounceTime
 * @owner Observable
 */
export function rateLimit<T>(dueTime: number, scheduler: SchedulerLike = asyncScheduler): MonoTypeOperatorFunction<T> {
    return (source: Observable<T>) => source.lift(new RateLimitTimeOperator(dueTime, scheduler));
}

class RateLimitTimeOperator<T> implements Operator<T, T> {
    constructor(private dueTime: number, private scheduler: SchedulerLike) {
    }

    call(subscriber: Subscriber<T>, source: any): TeardownLogic {
        return source.subscribe(new RateLimitTimeSubscriber(subscriber, this.dueTime, this.scheduler));
    }
}

/**
 * We need this JSDoc comment for affecting ESDoc.
 * @ignore
 * @extends {Ignored}
 */
class RateLimitTimeSubscriber<T> extends Subscriber<T> {
    private debouncedSubscription: Subscription = null;
    private lastValue: T = null;
    private hasValue: boolean = false;
    private isFirst: boolean = true;

    constructor(destination: Subscriber<T>,
        private dueTime: number,
        private scheduler: SchedulerLike) {
        super(destination);
    }

    protected _next(value: T) {
        if (this.isFirst) {
            this.destination.next(value);
            this.isFirst = false;
        }
        else {
            this.lastValue = value;
            this.hasValue = true;
            if (!this.debouncedSubscription) {
                this.debouncedSubscription = this.scheduler.schedule(dispatchNext, this.dueTime, this);
                this.add(this.debouncedSubscription);
            }
        }
    }

    protected _complete() {
        this.debouncedNext();
        this.destination.complete();
    }

    debouncedNext(): void {
        this.clearDebounce();
        this.isFirst = true;

        if (this.hasValue) {
            const { lastValue } = this;
            // This must be done *before* passing the value
            // along to the destination because it's possible for
            // the value to synchronously re-enter this operator
            // recursively when scheduled with things like
            // VirtualScheduler/TestScheduler.
            this.lastValue = null;
            this.hasValue = false;
            this.destination.next(lastValue);
        }
    }

    private clearDebounce(): void {
        const debouncedSubscription = this.debouncedSubscription;

        if (debouncedSubscription !== null) {
            this.remove(debouncedSubscription);
            debouncedSubscription.unsubscribe();
            this.debouncedSubscription = null;
        }
    }
}

function dispatchNext(subscriber: RateLimitTimeSubscriber<any>) {
    subscriber.debouncedNext();
}