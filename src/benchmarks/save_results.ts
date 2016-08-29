import * as fs from "fs";
import * as git from "git-rev-sync";
import * as async from "async";

const RESULTS_FILE = 'housekeeping/results.json';

export default function saveResults(benchmarkName:string, value:Number, callback:ErrorCallback) {
    return async.waterfall(
        [
            (cb)=>fs.readFile(RESULTS_FILE, cb),

            (rawFile, cb)=>async.asyncify(JSON.parse)(rawFile, cb),

            (results, cb)=> {
                const commit = git.long();

                if (!results[benchmarkName]) {
                    results[benchmarkName] = {};
                }

                if (!results[benchmarkName][commit]) {
                    results[benchmarkName][commit] = [];
                }

                results[benchmarkName][commit].push(value);

                const sum = results[benchmarkName][commit].reduce((previous, current)=>previous + current, 0);
                results[benchmarkName][commit + '-average'] = sum / results[benchmarkName][commit].length;

                return fs.writeFile(RESULTS_FILE, JSON.stringify(results, null, 2), cb)
            }
        ],
        callback
    )
}
