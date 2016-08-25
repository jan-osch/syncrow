import * as async from "async";
import {createPathSeries, removePath, getRandomString, compareDirectories} from "./test_utils";
import {Engine} from "../core/engine";
import {EventCounter} from "../utils/event_counter";
import startListeningEngine from "../core/listen";
import startConnectingEngine from "../core/connect";
import {pullAction} from "../sync/pull_action";

const FS_TIMEOUT = 400;

describe('SyncActions', function () {

    let listeningEngine;
    let connectingEngine;

    const token = '121cb2897o1289nnjos';
    const port = 4321;

    beforeEach((done)=> {
        return async.waterfall(
            [
                (cb)=>createPathSeries(
                    [
                        {path: 'sync_test/aaa', directory: true},
                        {path: 'sync_test/bbb', directory: true}
                    ],
                    cb
                ),

            ],
            done
        )
    });

    afterEach((done)=> {
        if (listeningEngine)listeningEngine.shutdown();
        if (connectingEngine)connectingEngine.shutdown();

        return removePath('sync_test', done);
    });


    describe('Pull Action', function () {


        it('two engines will synchronize multiple files both ways', function (done) {
            let counter:EventCounter;

            async.waterfall(
                [
                    (cb)=> {
                        return createPathSeries(
                            [
                                {path: 'sync_test/bbb/c.txt', content: getRandomString(50000)},
                                {path: 'sync_test/bbb/d.txt', content: getRandomString(500000)},
                                {path: 'sync_test/bbb/e.txt', content: getRandomString(500)},
                                {path: 'sync_test/bbb/f.txt', content: getRandomString(500)},
                            ],
                            cb
                        )
                    },

                    (cb)=> startListeningEngine('sync_test/aaa', port, {
                        authenticate: true,
                        externalHost: '0.0.0.0',
                        initialToken: token,
                        watch: true,
                        sync: pullAction
                    }, cb),

                    (engine, cb)=> {
                        listeningEngine = engine;

                        counter = EventCounter.getCounter(listeningEngine, Engine.events.synced, 1);

                        setImmediate(cb);
                    },

                    (cb)=>startConnectingEngine('sync_test/bbb', port, '0.0.0.0', {
                        authenticate: true,
                        initialToken: token,
                        watch: true
                    }, cb),

                    (engine, cb)=> {
                        connectingEngine = engine;
                        setImmediate(cb);
                    },

                    (cb)=> {
                        if (counter.hasFinished()) return setImmediate(cb);

                        counter.on(EventCounter.events.done, cb);
                    },

                    (cb)=>compareDirectories('sync_test/bbb', 'sync_test/aaa', cb)
                ],
                done
            );
        });
    });
});


