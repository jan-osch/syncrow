import * as async from "async";
import {createPathSeries} from "../utils/test_utils";
import startListeningEngine from "../core/listen";
import startConnectingEngine from "../core/connect";
import {Engine} from "../core/engine";
import * as crypto from "crypto";
import {EventCounter} from "../utils/event_counter";
import * as rimraf from "rimraf";
import {pushAction} from "../sync/push_action";


const token = '121cb2897o1289nnjos';
const port = 4321;

const SAMPLE_SIZE = 200000; // 200 KB

const FILE_NUMBER = 100;

let listeningEngine;
let connectingEngine;
let eventCounter:EventCounter;

let startTime;
let endTime;

async.waterfall(
    [
        (cb)=>rimraf('benchmark', cb),

        (cb)=> {
            const files:Array<any> = [
                {path: 'benchmark/aaa', directory: true},
                {path: 'benchmark/bbb', directory: true},
            ];

            for (let i = 0; i < FILE_NUMBER; i++) {
                files.push({path: `benchmark/bbb/small_${i}.txt`, content: crypto.randomBytes(SAMPLE_SIZE)})
            }

            return createPathSeries(files, cb)
        },

        (cb)=> {
            startTime = new Date();

            return startListeningEngine('benchmark/aaa', port, {
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

            return startConnectingEngine('benchmark/bbb', port, '0.0.0.0', {
                    authenticate: true,
                    initialToken: token,
                    watch: true,
                    sync: pushAction
                },
                cb
            )
        },

        (engine, cb)=> {
            connectingEngine = engine;

            eventCounter = EventCounter.getCounter(connectingEngine, Engine.events.synced, 1);

            return setImmediate(cb);
        },

        (cb)=> {
            if (eventCounter.hasFinished()) {
                return setImmediate(cb);
            }

            eventCounter.once(EventCounter.events.done, cb);
        },

        (cb)=> {
            endTime = new Date();

            return setImmediate(cb);
        },

        (cb)=> {
            listeningEngine.shutdown();
            connectingEngine.shutdown();
            return rimraf('benchmark', cb)
        }
    ],
    (err)=> {
        if (err) throw err;

        const difference = endTime.getTime() - startTime.getTime();

        console.log(`Benchmark with ${FILE_NUMBER} small files took: ${difference} ms`);
    }
);


