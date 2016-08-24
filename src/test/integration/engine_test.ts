import * as async from "async";
import {
    createPathSeries,
    removePath,
    compareTwoFiles,
    getRandomString,
    compareDirectories,
    countMultipleEvents,
    countEvents
} from "../test_utils";
import startListeningEngine from "../../core/listen";
import startConnectingEngine from "../../core/connect";
import {Engine} from "../../core/engine";
import * as mkdirp from "mkdirp";
import * as fs from "fs";
import {assert} from "chai";

const FS_TIMEOUT = 400;

describe('Engine', function () {

    let listeningEngine;
    let connectingEngine;
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
        const ifErrorBreak = (err)=> {
            if (err)return done(err);
        };

        countMultipleEvents(connectingEngine, [
                {eventName: Engine.events.newDirectory, count: 1},
                {eventName: Engine.events.changedFile, count: 1}
            ],
            (err)=> {
                if (err)return done(err);

                return compareTwoFiles('engine_test/aaa/inner/file.txt', 'engine_test/bbb/inner/file.txt', (err, result)=> {
                    if (err)return done(err);

                    assert(result.first !== result.second);
                    done();
                })
            }
        );

        mkdirp('engine_test/aaa/inner', ifErrorBreak);
        fs.writeFile('engine_test/aaa/inner/file.txt', getRandomString(4000), ifErrorBreak);
    });

    it('two engines will transfer handle deleting files', function (done) {
        const ifErrorBreak = (err)=> {
            if (err)return done(err);
        };

        countEvents(listeningEngine, Engine.events.deletedPath, 1, done);

        async.series(
            [
                cb=>mkdirp('engine_test/bbb/inner/', cb),
                cb=>fs.writeFile('engine_test/bbb/inner/file_1.txt', '123123123', 'utf8', cb),
                cb=>setTimeout(()=>removePath('engine_test/bbb/inner/file_1.txt', cb), FS_TIMEOUT)
            ],
            ifErrorBreak
        )
    });


    it('two engines will synchronize multiple files both ways', function (done) {
        const ifErrorBreak = (err)=> {
            if (err)return done(err);
        };

        let shouldEnd = false;

        const testEnd = (err)=> {
            if (err)return done(err);
            if (shouldEnd) return compareDirectories('engine_test/aaa', 'engine_test/bbb', done);
            shouldEnd = true;
        };

        countEvents(listeningEngine, Engine.events.changedFile, 4, testEnd);
        countEvents(connectingEngine, Engine.events.changedFile, 2, testEnd);

        createPathSeries(
            [
                {path: 'engine_test/aaa/a.txt', content: getRandomString(50000)},
                {path: 'engine_test/aaa/b.txt', content: getRandomString(50000)},
                {path: 'engine_test/bbb/c.txt', content: getRandomString(50000)},
                {path: 'engine_test/bbb/d.txt', content: getRandomString(500000)},
                {path: 'engine_test/bbb/e.txt', content: getRandomString(500)},
                {path: 'engine_test/bbb/f.txt', content: getRandomString(500)},
            ],
            ifErrorBreak
        )
    });

});

