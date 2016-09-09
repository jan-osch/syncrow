import {EventEmitter} from "events";
import {EventCounter} from "../utils/event_counter";
import {expect} from "chai";

describe('EventCounter', function () {
    it('will emit done event when given event was emitted count number of times', function (done) {
        let number = 5;

        const emitter = new EventEmitter();
        const eventCounter = new EventCounter(emitter, [{name: 'mock', count: number}]);

        eventCounter.on(EventCounter.events.done, done);

        while (number-- > 0) {
            emitter.emit('mock');
        }
    });

    it('if there was no listener for done event, the hasFinished method will return true when counter finished', function () {
        let number = 5;

        const emitter = new EventEmitter();
        const eventCounter = new EventCounter(emitter, [{name: 'mock', count: number}]);

        while (number-- > 0) {
            emitter.emit('mock');
        }

        expect(eventCounter.hasFinished()).to.be.ok;
    });
});