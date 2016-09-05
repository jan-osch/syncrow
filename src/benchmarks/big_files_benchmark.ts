import * as async from "async";
import {createPathSeries, CreatePathArgument} from "../utils/fs_test_utils";
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
const SAMPLE_SIZE = 200000000; // 200 MB
const FILE_NUMBER = 4;
const TIMEOUT = 60 * 1000; //1 minute

const benchmarkName = `big_files ${FILE_NUMBER} files x ${SAMPLE_SIZE}B`;

let listeningEngine;
let connectingEngine;
let eventCounter:EventCounter;
let startTime;
let endTime;

setTimeout(()=> {
    throw new Error('Timeout out')
}, TIMEOUT);

const paths:Array<CreatePathArgument> = [
    {path: 'build/benchmark/aaa', directory: true},
    {path: 'build/benchmark/bbb', directory: true}
];

for (let i = 0; i < FILE_NUMBER; i++) {
    paths.push({path: `build/benchmark/bbb/big_${i + 1}.txt`, content: crypto.randomBytes(SAMPLE_SIZE)})
}

async.waterfall(
    [
        (cb)=>rimraf('build/benchmark', cb),

        (cb)=>createPathSeries(paths, cb),

        (cb)=> {
            startTime = new Date();

            return startListeningEngine('build/benchmark/aaa', PORT, {
                    authenticate: true,
                    externalHost: '127.0.0.1',
                    initialToken: TOKEN,
                    watch: true
                },
                cb
            );
        },

        (engine, cb)=> {
            listeningEngine = engine;

            return startConnectingEngine('build/benchmark/bbb', PORT, '127.0.0.1', {
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

            console.log(`Benchmark with big files took: ${difference} ms`);

            return saveResults(benchmarkName, difference, cb);
        }
    ],
    (err)=> {
        if (err) throw err;
        return process.exit(0);
    }
);

