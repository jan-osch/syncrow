import * as async from "async";
import {createPathSeries, compareDirectories} from "../utils/fs_test_utils";
import {Engine} from "../core/engine";
import * as crypto from "crypto";
import {EventCounter} from "../utils/event_counter";
import * as rimraf from "rimraf";
import {pushAction} from "../sync/push_action";
import saveResults from "./save_results";
import SListen from "../facade/server";
import SConnect from "../facade/client";


const TOKEN = '121cb2897o1289nnjos';
const PORT = 4321;
const SAMPLE_SIZE = 20000; // 20 KB
const FILE_NUMBER = 1000; // 1000 * 20 = 20 000 KB = 20MB
const TIMEOUT = 30000; //30 seconds
const AUTH_TIMEOUT = 5000; //5 seconds

const benchmarkName = `small_files ${FILE_NUMBER} files x ${SAMPLE_SIZE}B`;

let listeningEngine;
let connectingEngine;
let eventCounter:EventCounter;
let startTime;
let endTime;

setTimeout(()=> {
    throw new Error(`Benchmark timeout out after: ${TIMEOUT} miliseconds`)
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

            listeningEngine = new SListen({
                path: 'build/benchmark/aaa',
                localPort: PORT,
                authenticate: true,
                externalHost: '127.0.0.1',
                authTimeout: AUTH_TIMEOUT,
                initialToken: TOKEN,
                watch: true
            });

            return listeningEngine.start(cb);
        },

        (cb)=> {


            connectingEngine = new SConnect({
                    path: 'build/benchmark/bbb',
                    remotePort: PORT,
                    remoteHost: '127.0.0.1',
                    authenticate: true,
                    initialToken: TOKEN,
                    watch: true,
                    sync: pushAction
                }
            );
            eventCounter = EventCounter.getCounter(connectingEngine.engine, Engine.events.synced, 1);
            return connectingEngine.start(cb);
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
            return compareDirectories('build/benchmark/aaa', 'build/benchmark/bbb', cb);
        },
        (cb)=>rimraf('build/benchmark', cb),

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


