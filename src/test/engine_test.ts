import * as async from "async";
import {
    createPathSeries,
    removePath,
    getRandomString,
    compareDirectories,
    createPath,
    pathExists
} from "../utils/fs_test_utils";
import startListeningEngine from "../core/listen";
import startConnectingEngine from "../core/connect";
import {Engine} from "../core/engine";
import * as mkdirp from "mkdirp";
import * as fs from "fs";
import {EventCounter} from "../utils/event_counter";
import * as assert from "assert";

const FS_TIMEOUT = 400;
const TEST_DIR = 'engine_test';

describe('Engine', function () {

    let listeningEngine;
    let connectingEngine;
    let counter:EventCounter;

    const token = '121cb2897o1289nnjos';
    const port = 4321;

    beforeEach((done)=> {
        return async.waterfall(
            [
                (cb)=>removePath(TEST_DIR, cb),

                (cb)=>createPathSeries(
                    [
                        {path: `${TEST_DIR}/aaa`, directory: true},
                        {path: `${TEST_DIR}/bbb`, directory: true}
                    ],
                    cb
                ),

                (cb)=> {
                    startListeningEngine({
                            path: `${TEST_DIR}/aaa`,
                            localPort: port,
                            authenticate: true,
                            externalHost: '127.0.0.1',
                            initialToken: token,
                            watch: true
                        },
                        cb
                    );
                },

                (engine, cb)=> {
                    listeningEngine = engine;

                    return startConnectingEngine({
                            path: `${TEST_DIR}/bbb`,
                            remotePort: port,
                            remoteHost: '127.0.0.1',
                            authenticate: true,
                            initialToken: token,
                            watch: true,
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

        return removePath(TEST_DIR, done);
    });


    it('two engines will transfer new file and and create new directory when needed', function (done) {
        counter = new EventCounter(connectingEngine, [
            {name: Engine.events.newDirectory, count: 1},
            {name: Engine.events.newFile, count: 1}
        ]);

        async.series(
            [
                (cb)=>mkdirp(`${TEST_DIR}/aaa/directory`, cb),

                (cb)=>createPath(`${TEST_DIR}/aaa/file.txt`, getRandomString(4000), false, cb),

                (cb)=> {
                    if (counter.hasFinished()) return setImmediate(cb);

                    return counter.on(EventCounter.events.done, cb);
                }
            ],

            (err)=> {
                assert(pathExists(`${TEST_DIR}/bbb/file.txt`), 'Path on reflected directory must exist');
                done(err);
            }
        )
    });

    it('two engines will transfer handle deleting files', function (done) {
        counter = EventCounter.getCounter(listeningEngine, Engine.events.deletedPath, 1);

        async.series(
            [
                (cb)=>mkdirp(`${TEST_DIR}/bbb/`, cb),

                (cb)=>fs.writeFile(`${TEST_DIR}/bbb/file_1.txt`, '123123123', 'utf8', cb),

                (cb)=>setTimeout(()=>removePath(`${TEST_DIR}/bbb/file_1.txt`, cb), FS_TIMEOUT),

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
                            {path: `${TEST_DIR}/aaa/a.txt`, content: getRandomString(50000)},
                            {path: `${TEST_DIR}/aaa/b.txt`, content: getRandomString(50000)},

                            {path: `${TEST_DIR}/bbb/c.txt`, content: getRandomString(50000)},
                            {path: `${TEST_DIR}/bbb/d.txt`, content: getRandomString(500000)},
                            {path: `${TEST_DIR}/bbb/e.txt`, content: getRandomString(500)},
                            {path: `${TEST_DIR}/bbb/f.txt`, content: getRandomString(500)},
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

                (cb)=>compareDirectories(`${TEST_DIR}/aaa`, `${TEST_DIR}/bbb`, cb)
            ],

            done
        )

    });

});

