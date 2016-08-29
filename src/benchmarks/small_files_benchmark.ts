import * as async from "async";
import {createPathSeries} from "../utils/test_utils";
import startListeningEngine from "../core/listen";
import startConnectingEngine from "../core/connect";
import {Engine} from "../core/engine";
import * as crypto from "crypto";
import {EventCounter} from "../utils/event_counter";
import * as rimraf from "rimraf";
import {pushAction} from "../sync/push_action";
import saveResults from "./save_results";


const TOKEN = '121cb2897o1289nnjos';
const PORT = 4321;
const SAMPLE_SIZE = 20000; // 20 KB
const FILE_NUMBER = 1000; // 1000 * 20 = 20 000 KB = 20MB
const TIMEOUT = 10000; //10 seconds

const benchmarkName = `small_files ${FILE_NUMBER} files x ${SAMPLE_SIZE}B`;

let listeningEngine;
let connectingEngine;
let eventCounter:EventCounter;
let startTime;
let endTime;

setTimeout(()=> {
    throw new Error('Timeout out')
}, TIMEOUT);


async.waterfall(
    [
        (cb)=>rimraf('build/benchmark', cb),

        (cb)=> {
            const files:Array<any> = [
                {path: 'build/benchmark/aaa', directory: true},
                {path: 'build/benchmark/bbb', directory: true},
            ];

            for (let i = 0; i < FILE_NUMBER; i++) {
                files.push({path: `build/benchmark/bbb/small_${i}.txt`, content: crypto.randomBytes(SAMPLE_SIZE)})
            }

            return createPathSeries(files, cb)
        },

        (cb)=> {
            startTime = new Date();

            return startListeningEngine('build/benchmark/aaa', PORT, {
                    authenticate: true,
                    externalHost: '0.0.0.0',
                    initialToken: TOKEN,
                    watch: true
                },
                cb
            );
        },

        (engine, cb)=> {
            listeningEngine = engine;

            return startConnectingEngine('build/benchmark/bbb', PORT, '0.0.0.0', {
                    authenticate: true,
                    initialToken: TOKEN,
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
            return rimraf('build/benchmark', cb)
        },

        (cb)=> {
            const difference = endTime.getTime() - startTime.getTime();

            console.log(`Benchmark with ${FILE_NUMBER} small files took: ${difference} ms`);

            return saveResults(benchmarkName, difference, cb);
        }
    ],
    (err)=> {
        if (err) throw err;

        return process.exit(0);
    }
);


