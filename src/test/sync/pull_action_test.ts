import * as async from "async";
import {createPathSeries, removePath, getRandomString, compareDirectories, pathExists} from "../../utils/fs_test_utils";
import {Engine} from "../../core/engine";
import {EventCounter} from "../../utils/event_counter";
import startListeningEngine from "../../core/listen";
import startConnectingEngine from "../../core/connect";
import {setDeleteLocalFiles} from "../../sync/sync_actions";
import {expect} from "chai";
import {pullAction} from "../../sync/pull_action";
import * as sinon from "sinon";

const token = '12897371023o1289nnjos';
const port = 4321;
const TEST_DIR = 'pull_test';

describe('PullAction', function () {

    let listeningEngine;
    let connectingEngine;
    let sandbox;

    beforeEach((done)=> {
        sandbox = sinon.sandbox.create();

        return async.waterfall(
            [
                (cb)=>removePath(TEST_DIR, cb),
                (cb)=>createPathSeries(
                    [
                        {path: TEST_DIR, directory: true},
                        {path: `${TEST_DIR}/dir_list`, directory: true},
                        {path: `${TEST_DIR}/dir_conn`, directory: true}
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
        sandbox.restore();

        return removePath(TEST_DIR, done);
    });


    it('will make both file trees identical, will not synchronize existing files', function (done) {
        let counter:EventCounter;

        async.waterfall(
            [
                (cb)=> {
                    const sameContent = getRandomString(500);

                    return createPathSeries(
                        [
                            {path: `${TEST_DIR}/dir_conn/a.txt`, content: getRandomString(50000)},
                            {path: `${TEST_DIR}/dir_conn/b.txt`, content: getRandomString(50000)},
                            {path: `${TEST_DIR}/dir_conn/c.txt`, content: getRandomString(500)},
                            {path: `${TEST_DIR}/dir_conn/same.txt`, content: sameContent},// the same file
                            {path: `${TEST_DIR}/dir_list/same.txt`, content: sameContent} // should not be synced
                        ],
                        cb
                    )
                },

                (cb)=> startListeningEngine(`${TEST_DIR}/dir_list`, port, {
                    authenticate: true,
                    externalHost: '127.0.0.1',
                    initialToken: token,
                    watch: true,
                    sync: pullAction
                }, cb),

                (engine, cb)=> {
                    listeningEngine = engine;
                    sandbox.spy(listeningEngine, 'requestRemoteFile');
                    counter = EventCounter.getCounter(listeningEngine, Engine.events.synced, 1);

                    return setImmediate(cb);
                },

                (cb)=>startConnectingEngine(`${TEST_DIR}/dir_conn`, port, '127.0.0.1', {
                    authenticate: true,
                    initialToken: token,
                    watch: true
                }, cb),

                (engine, cb)=> {
                    connectingEngine = engine;
                    return setImmediate(cb);
                },

                (cb)=> {
                    if (counter.hasFinished()) return setImmediate(cb);

                    counter.on(EventCounter.events.done, cb);
                },

                (cb)=>compareDirectories(`${TEST_DIR}/dir_conn`, `${TEST_DIR}/dir_list`, cb),

                (cb)=> {
                    expect(listeningEngine.requestRemoteFile.neverCalledWithMatch(()=>true, 'same.txt')).to.be.ok;
                    setImmediate(cb);
                }
            ],
            done
        );
    });

    it('with setDeleteLocalFiles with delete any local files that do not exist remotely', function (done) {
        let counter:EventCounter;

        async.waterfall(
            [
                (cb)=> {

                    const sameContent = getRandomString(500);
                    return createPathSeries(
                        [
                            {path: `${TEST_DIR}/dir_conn/a.txt`, content: getRandomString(50000)},
                            {path: `${TEST_DIR}/dir_conn/b.txt`, content: getRandomString(50000)},
                            {path: `${TEST_DIR}/dir_conn/same.txt`, content: sameContent},
                            {path: `${TEST_DIR}/dir_list/same.txt`, content: sameContent},
                            {path: `${TEST_DIR}/dir_list/file_to_delete.txt`, content: getRandomString(500)},
                        ],
                        cb
                    )
                },

                (cb)=> startListeningEngine(`${TEST_DIR}/dir_list`, port, {
                    authenticate: true,
                    externalHost: '127.0.0.1',
                    initialToken: token,
                    watch: true,
                    sync: setDeleteLocalFiles(pullAction)
                }, cb),

                (engine, cb)=> {
                    listeningEngine = engine;
                    sandbox.spy(listeningEngine, 'requestRemoteFile');
                    counter = EventCounter.getCounter(listeningEngine, Engine.events.synced, 1);

                    setImmediate(cb);
                },

                (cb)=>startConnectingEngine(`${TEST_DIR}/dir_conn`, port, '127.0.0.1', {
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

                (cb)=>compareDirectories(`${TEST_DIR}/dir_conn`, `${TEST_DIR}/dir_list`, cb),

                (cb)=> {

                    expect(pathExists(`${TEST_DIR}/dir_conn/file_to_delete.txt`)).to.equal(false);
                    expect(listeningEngine.requestRemoteFile.neverCalledWithMatch(()=>true, 'same.txt')).to.be.ok;

                    setImmediate(cb);
                }
            ],
            done
        );
    })
});



