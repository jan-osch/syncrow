import * as async from "async";
import {createPathSeries, removePath, getRandomString, compareDirectories, pathExists} from "../../utils/fs_test_utils";
import {Engine} from "../../core/engine";
import {EventCounter} from "../../utils/event_counter";
import {pushAction} from "../../sync/push_action";
import {setDeleteRemoteFiles} from "../../sync/sync_actions";
import {expect} from "chai";
import SListen from "../../facade/listen";
import SConnect from "../../facade/connect";
import * as path from "path";

const TEST_DIR = path.join(__dirname, 'push_test');
const TOKEN = '121cb2897o1289nnjos';
const PORT = 4321;

describe('PushAction', function () {

    let listeningEngine;
    let connectingEngine;


    beforeEach((done)=> {
        return async.waterfall(
            [
                (cb)=>removePath(TEST_DIR, cb),

                (cb)=>createPathSeries(
                    [
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

        return removePath(TEST_DIR, done);
    });


    it('will make the both file trees identical', function (done) {
        let counter:EventCounter;

        async.waterfall(
            [
                (cb)=> {
                    const sameContent = getRandomString(500);
                    return createPathSeries(
                        [
                            {path: `${TEST_DIR}/dir_list/c.txt`, content: getRandomString(50000)},
                            {path: `${TEST_DIR}/dir_list/d.txt`, content: getRandomString(50000)},
                            {path: `${TEST_DIR}/dir_list/e.txt`, content: getRandomString(500)},
                            {path: `${TEST_DIR}/dir_list/same_file.txt`, content: sameContent},
                            {path: `${TEST_DIR}/dir_conn/same_file.txt`, content: sameContent},
                        ],
                        cb
                    )
                },

                (cb)=> {
                    listeningEngine = new SListen({
                        path: `${TEST_DIR}/dir_list`, localPort: PORT,
                        authenticate: true,
                        externalHost: '127.0.0.1',
                        initialToken: TOKEN,
                        watch: true,
                        sync: pushAction
                    });

                    counter = EventCounter.getCounter(listeningEngine.engine, Engine.events.synced, 1);

                    return listeningEngine.start(cb)
                },

                (cb)=> {
                    connectingEngine = new SConnect({
                        path: `${TEST_DIR}/dir_conn`,
                        remotePort: PORT,
                        remoteHost: '127.0.0.1',
                        authenticate: true,
                        initialToken: TOKEN,
                        watch: true
                    });

                    return connectingEngine.start(cb)
                },

                (cb)=> {
                    if (counter.hasFinished()) return setImmediate(cb);

                    counter.on(EventCounter.events.done, cb);
                },

                (cb)=>compareDirectories(`${TEST_DIR}/dir_conn`, `${TEST_DIR}/dir_list`, cb)
            ],
            done
        );
    });

    it('with delete remoteFiles will delete remote files remote ', function (done) {
        let counter:EventCounter;

        async.waterfall(
            [
                (cb)=> {
                    const contentF = getRandomString(500);
                    return createPathSeries(
                        [
                            {path: `${TEST_DIR}/dir_list/c.txt`, content: getRandomString(50000)},
                            {path: `${TEST_DIR}/dir_list/d.txt`, content: getRandomString(50000)},
                            {path: `${TEST_DIR}/dir_list/e.txt`, content: getRandomString(500)},
                            {path: `${TEST_DIR}/dir_list/f.txt`, content: contentF},
                            {path: `${TEST_DIR}/dir_conn/file_to_delete.txt`, content: contentF},
                        ],
                        cb
                    )
                },

                (cb)=> {
                    listeningEngine = new SListen({
                        path: `${TEST_DIR}/dir_list`, localPort: PORT,
                        authenticate: true,
                        externalHost: '127.0.0.1',
                        initialToken: TOKEN,
                        watch: true,
                        sync: setDeleteRemoteFiles(pushAction)
                    });

                    counter = EventCounter.getCounter(listeningEngine.engine, Engine.events.synced, 1);

                    return listeningEngine.start(cb)
                },

                (cb)=> {
                    connectingEngine = new SConnect({
                        path: `${TEST_DIR}/dir_conn`,
                        remotePort: PORT,
                        remoteHost: '127.0.0.1',
                        authenticate: true,
                        initialToken: TOKEN,
                        watch: true
                    });

                    return connectingEngine.start(cb)
                },

                (cb)=> {
                    if (counter.hasFinished()) return setImmediate(cb);

                    counter.on(EventCounter.events.done, cb);
                },

                (cb)=>compareDirectories(`${TEST_DIR}/dir_conn`, `${TEST_DIR}/dir_list`, cb),

                (cb)=> {

                    expect(pathExists(`${TEST_DIR}/dir_conn/file_to_delete.txt`)).to.equal(false);

                    setImmediate(cb);
                }
            ],
            done
        );
    })
});


