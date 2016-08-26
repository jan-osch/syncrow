import * as async from "async";
import {createPathSeries, removePath, compareTwoFiles, getRandomString, compareDirectories} from "../utils/test_utils";
import startListeningEngine from "../core/listen";
import startConnectingEngine from "../core/connect";
import {Engine} from "../core/engine";
import * as mkdirp from "mkdirp";
import * as fs from "fs";
import {EventCounter} from "../utils/event_counter";

const FS_TIMEOUT = 400;

describe('Engine', function () {

    let listeningEngine;
    let connectingEngine;
    let counter:EventCounter;

    const token = '121cb2897o1289nnjos';
    const port = 4321;

    beforeEach((done)=> {
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
                    startListeningEngine('engine_test/aaa', port, {
                            authenticate: true,
                            externalHost: '0.0.0.0',
                            initialToken: token,
                            watch: true
                        },
                        cb
                    );
                },

                (engine, cb)=> {
                    listeningEngine = engine;

                    return startConnectingEngine('engine_test/bbb', port, '0.0.0.0', {
                            authenticate: true,
                            initialToken: token,
                            watch: true
                        },
                        cb
                    )
                },

                (engine, cb)=> {
                    connectingEngine = engine;
                    return setImmediate(cb);
                }
            ],
            done
        )
    });

    afterEach((done)=> {
        if (listeningEngine)listeningEngine.shutdown();
        if (connectingEngine)connectingEngine.shutdown();

        return removePath('engine_test', done);
    });


    it('two engines will transfer new file and and create new directory when needed', function (done) {
        counter = new EventCounter(connectingEngine, [
            {name: Engine.events.newDirectory, count: 1},
            {name: Engine.events.newFile, count: 1}
        ]);

        async.series(
            [
                (cb)=>mkdirp('engine_test/aaa/directory', cb),

                (cb)=>fs.writeFile('engine_test/aaa/file.txt', getRandomString(4000), cb),

                (cb)=> {
                    if (counter.hasFinished()) return setImmediate(cb);

                    return counter.on(EventCounter.events.done, cb);
                },

                (cb)=>compareTwoFiles('engine_test/aaa/file.txt', 'engine_test/bbb/file.txt', cb)
            ],

            done
        )
    });

    it('two engines will transfer handle deleting files', function (done) {
        counter = EventCounter.getCounter(listeningEngine, Engine.events.deletedPath, 1);

        async.series(
            [
                (cb)=>mkdirp('engine_test/bbb/', cb),

                (cb)=>fs.writeFile('engine_test/bbb/file_1.txt', '123123123', 'utf8', cb),

                (cb)=>setTimeout(()=>removePath('engine_test/bbb/file_1.txt', cb), FS_TIMEOUT),

                (cb)=> {
                    if (counter.hasFinished()) return setImmediate(cb);

                    return counter.on(EventCounter.events.done, cb);
                }
            ],

            done
        )
    });


    it('two engines will synchronize multiple files both ways', function (done) {
        const listenerCounter = EventCounter.getCounter(listeningEngine, Engine.events.newFile, 4);
        const connectingCounter = EventCounter.getCounter(connectingEngine, Engine.events.newFile, 2);

        async.series(
            [
                (cb)=> {
                    return createPathSeries(
                        [
                            {path: 'engine_test/aaa/a.txt', content: getRandomString(50000)},
                            {path: 'engine_test/aaa/b.txt', content: getRandomString(50000)},

                            {path: 'engine_test/bbb/c.txt', content: getRandomString(50000)},
                            {path: 'engine_test/bbb/d.txt', content: getRandomString(500000)},
                            {path: 'engine_test/bbb/e.txt', content: getRandomString(500)},
                            {path: 'engine_test/bbb/f.txt', content: getRandomString(500)},
                        ],
                        cb
                    )
                },

                (cb)=> {
                    if (listenerCounter.hasFinished()) return setImmediate(cb);

                    return listenerCounter.on(EventCounter.events.done, cb);
                },

                (cb)=> {
                    if (connectingCounter.hasFinished()) return setImmediate(cb);

                    return connectingCounter.on(EventCounter.events.done, cb);
                },

                (cb)=>compareDirectories('engine_test/aaa', 'engine_test/bbb', cb)
            ],

            done
        )

    });

});

