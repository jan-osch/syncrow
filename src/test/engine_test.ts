import * as async from "async";
import {createPathSeries, removePath, compareTwoFiles, getRandomString} from "./test_utils";
import startListeningEngine from "../core/listen";
import startConnectingEngine from "../core/connect";
import {Engine} from "../core/engine";
import {EventEmitter} from "events";
import * as mkdirp from "mkdirp";
import * as fs from "fs";
import {assert} from "chai";

describe('Engine', function () {


    it('two engines may connect using the same token', function (done) {
        const token = '121cb2897o1289nnjos';

        let listeningEngine;
        let connectingEngine;

        const cleanup = (previousError)=> {
            if (listeningEngine)listeningEngine.shutdown();
            if (connectingEngine)connectingEngine.shutdown();

            return removePath('engine_test', (err)=> {
                if (err)return done(err);
                if (previousError)return done(previousError);

                return done();
            });
        };

        return async.waterfall(
            [
                (cb)=>createPathSeries(
                    [
                        {path: 'engine_test/aaa', directory: true},
                        {path: 'engine_test/bbb', directory: true}
                    ],
                    cb
                ),

                (cb)=> {
                    startListeningEngine('engine_test/aaa', 4321, {
                        authenticate: true,
                        externalHost: '0.0.0.0',
                        initialToken: token,
                        watch: true
                    }, cb);
                },

                (engine, cb)=> {
                    listeningEngine = engine;

                    return startConnectingEngine(4321, '0.0.0.0', 'engine_test/bbb', {
                        authenticate: true,
                        initialToken: token,
                        watch: true
                    }, cb)
                },

                (engine, cb)=> {
                    connectingEngine = engine;
                    return setImmediate(cb);
                }
            ],
            cleanup
        )
    });


    it('two engines will transfer new file and and create new directory when needed', function (done) {
        const token = '121cb2897o1289nnjos';

        let listeningEngine;
        let connectingEngine;

        const cleanup = (previousError)=> {
            if (listeningEngine)listeningEngine.shutdown();
            if (connectingEngine)connectingEngine.shutdown();

            return removePath('engine_test', (err)=> {
                if (err)return done(err);
                if (previousError)return done(previousError);

                return done();
            });
        };

        return async.waterfall(
            [
                (cb)=>createPathSeries(
                    [
                        {path: 'engine_test/aaa', directory: true},
                        {path: 'engine_test/bbb', directory: true}
                    ],
                    cb
                ),

                (cb)=> {
                    startListeningEngine('engine_test/aaa', 4323, {
                        authenticate: true,
                        externalHost: '0.0.0.0',
                        initialToken: token,
                        watch: true
                    }, cb);
                },

                (engine, cb)=> {
                    listeningEngine = engine;

                    return startConnectingEngine(4323, '0.0.0.0', 'engine_test/bbb', {
                        authenticate: true,
                        initialToken: token,
                        watch: true
                    }, cb)
                },

                (engine, cb)=> {
                    connectingEngine = engine;

                    countMultipleEvents(connectingEngine, [
                            {eventName: Engine.events.newDirectory, count: 1},
                            {eventName: Engine.events.changedFile, count: 1}
                        ],
                        (err)=> {
                            if (err)return cb(err);

                            return compareTwoFiles('engine_test/aaa/inner/file.txt', 'engine_test/bbb/inner/file.txt', (err, result)=> {
                                if (err)return cb(err);

                                assert(result.first !== result.second);
                                cb();
                            })
                        }
                    );

                    const ifErrorBreak = (err)=> {
                        if (err)return cb(err);
                    };

                    mkdirp('engine_test/aaa/inner', ifErrorBreak);
                    fs.writeFile('engine_test/aaa/inner/file.txt', getRandomString(4000), ifErrorBreak);

                }
            ],
            cleanup
        )
    });

    xit('two engines will transfer handle deleting files', function (done) {
        const token = '121cb2897o1289nnjos';

        let listeningEngine;
        let connectingEngine;

        const cleanup = (previousError)=> {
            if (listeningEngine)listeningEngine.shutdown();
            if (connectingEngine)connectingEngine.shutdown();

            return removePath('engine_test', (err)=> {
                if (err)return done(err);
                if (previousError)return done(previousError);

                return done();
            });
        };

        return async.waterfall(
            [
                (cb)=>createPathSeries(
                    [
                        {path: 'engine_test/aaa', directory: true},
                        {path: 'engine_test/bbb', directory: true}
                    ],
                    cb
                ),

                (cb)=> {
                    startListeningEngine('engine_test/aaa', 4325, {
                        authenticate: true,
                        externalHost: '0.0.0.0',
                        initialToken: token,
                        watch: true
                    }, cb);
                },

                (engine, cb)=> {
                    listeningEngine = engine;

                    return startConnectingEngine(4325, '0.0.0.0', 'engine_test/bbb', {
                        authenticate: true,
                        initialToken: token,
                        watch: true
                    }, cb)
                },

                (engine, cb)=> {
                    connectingEngine = engine;

                    countEvents(listeningEngine, Engine.events.deletedPath, 1, cb);

                    const ifErrorBreak = (err)=> {
                        if (err)return cb(err);
                    };

                    async.waterfall(
                        [
                            cb=>mkdirp('engine_test/bbb/inner', cb),
                            cb=>fs.writeFile('engine_test/bbb/inner/file_1.txt', '123123123', cb),
                            cb=>removePath('engine_test/bbb/inner/file_1.txt', cb)
                        ],
                        ifErrorBreak
                    )
                }
            ],
            cleanup
        )
    })
});

function countMultipleEvents(emitter:EventEmitter, events:Array<{eventName:string, count:number}>, callback:ErrorCallback) {
    return async.each(
        events,

        (eventAndCount, cb)=> countEvents(emitter, eventAndCount.eventName, eventAndCount.count, cb),

        callback
    )
}


function countEvents(emitter:EventEmitter, eventName:string, count:number, callback:Function) {
    let emitted = 0;

    const finish = ()=> {
        emitter.removeListener(eventName, checkEmitted);
        callback();
    };

    const checkEmitted = ()=> {
        emitted++;

        if (emitted === count) {
            finish();
        }
    };

    return emitter.on(eventName, checkEmitted);
}