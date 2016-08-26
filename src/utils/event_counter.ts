import {EventEmitter} from "events";
import {debugFor} from "./logger";

export class EventCounter extends EventEmitter {
    static events = {
        done: 'done'
    };

    private numberUnfinishedCounters:number;
    private listenerMap:Map<string,Function>;

    constructor(private subject:EventEmitter, eventsAndCounts:Array<{name:string, count:number}>) {
        super();

        this.numberUnfinishedCounters = eventsAndCounts.length;
        this.listenerMap = new Map();

        eventsAndCounts.forEach(event=> {
            const listener = this.createCountFunction(event.count);

            this.listenerMap.set(event.name, listener);

            this.subject.on(event.name, listener);
        });
    }

    /**
     * @returns {boolean}
     */
    public hasFinished():boolean {
        return this.numberUnfinishedCounters === 0;
    }

    /**
     * @param subject
     * @param eventName
     * @param count
     * @returns {EventCounter}
     */
    public static getCounter(subject:EventEmitter, eventName:string, count:number):EventCounter {
        return new EventCounter(subject, [{name: eventName, count: count}])
    }

    private createCountFunction(count:number) {
        let emittedSoFar = 0;

        return ()=> {
            emittedSoFar++;

            if (emittedSoFar === count) {
                this.numberUnfinishedCounters--;

                if (this.hasFinished()) {
                    this.finish();
                }
            }
        }
    }

    private finish() {
        this.listenerMap.forEach(
            (listener, name)=>this.subject.removeListener(name, listener)
        );

        this.emit(EventCounter.events.done);
    }
}
