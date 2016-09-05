import * as async from "async";
import {createPathSeries, removePath, getRandomString, compareDirectories, pathExists} from "../../utils/test_utils";
import {Engine} from "../../core/engine";
import {EventCounter} from "../../utils/event_counter";
import startListeningEngine from "../../core/listen";
import startConnectingEngine from "../../core/connect";
import {pushAction} from "../../sync/push_action";
import {setDeleteRemoteFiles} from "../../sync/sync_actions";
import {expect} from "chai";


describe('PushAction', function () {

    let listeningEngine;
    let connectingEngine;

    const token = '121cb2897o1289nnjos';
    const port = 4321;

    beforeEach((done)=> {
        return async.waterfall(
            [
                (cb)=>removePath('push_test', cb),

                (cb)=>createPathSeries(
                    [
                        {path: 'push_test/dir_conn', directory: true},
                        {path: 'push_test/dir_list', directory: true}
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

        return removePath('push_test', done);
    });


    it('will make the both file trees identical', function (done) {
        let counter:EventCounter;

        async.waterfall(
            [
                (cb)=> {
                    const sameContent = getRandomString(500);
                    return createPathSeries(
                        [
                            {path: 'push_test/dir_conn/c.txt', content: getRandomString(50000)},
                            {path: 'push_test/dir_conn/d.txt', content: getRandomString(50000)},
                            {path: 'push_test/dir_conn/e.txt', content: getRandomString(500)},
                            {path: 'push_test/dir_conn/same_file.txt', content: sameContent},
                            {path: 'push_test/dir_list/same_file.txt', content: sameContent},
                        ],
                        cb
                    )
                },

                (cb)=> startListeningEngine('push_test/dir_conn', port, {
                    authenticate: true,
                    externalHost: '127.0.0.1',
                    initialToken: token,
                    watch: true,
                    sync: pushAction
                }, cb),

                (engine, cb)=> {
                    listeningEngine = engine;

                    counter = EventCounter.getCounter(listeningEngine, Engine.events.synced, 1);

                    setImmediate(cb);
                },

                (cb)=>startConnectingEngine('push_test/dir_list', port, '127.0.0.1', {
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

                (cb)=>compareDirectories('push_test/dir_list', 'push_test/dir_conn', cb)
            ],
            done
        );
    });

    it('with delete remoteFiles will delete remote filesremote ', function (done) {
        let counter:EventCounter;

        async.waterfall(
            [
                (cb)=> {
                    const contentF = getRandomString(500);
                    return createPathSeries(
                        [
                            {path: 'push_test/dir_conn/c.txt', content: getRandomString(50000)},
                            {path: 'push_test/dir_conn/d.txt', content: getRandomString(50000)},
                            {path: 'push_test/dir_conn/e.txt', content: getRandomString(500)},
                            {path: 'push_test/dir_conn/f.txt', content: contentF},
                            {path: 'push_test/dir_list/file_to_delete.txt', content: contentF},
                        ],
                        cb
                    )
                },

                (cb)=> startListeningEngine('push_test/dir_conn', port, {
                    authenticate: true,
                    externalHost: '127.0.0.1',
                    initialToken: token,
                    watch: true,
                    sync: setDeleteRemoteFiles(pushAction)
                }, cb),

                (engine, cb)=> {
                    listeningEngine = engine;

                    counter = EventCounter.getCounter(listeningEngine, Engine.events.synced, 1);

                    setImmediate(cb);
                },

                (cb)=>startConnectingEngine('push_test/dir_list', port, '127.0.0.1', {
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

                (cb)=>compareDirectories('push_test/dir_list', 'push_test/dir_conn', cb),

                (cb)=> {

                    expect(pathExists('push_test/dir_list/file_to_delete.txt')).to.equal(false);

                    setImmediate(cb);
                }
            ],
            done
        );
    })
});


