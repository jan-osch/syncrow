import * as async from "async";
import * as fs from "fs";
import {Stats} from "fs";
import * as path from "path";

export interface ReadTreeOptions {
    filter?:(s:string)=>boolean;
    onlyFiles?:boolean
}

//TODO add docs
export function readTree(root:string, options:ReadTreeOptions,
                         callback:(err:Error, result:Array<string>)=>any) {
    const filter = options.filter ? options.filter : s=> false;
    let results = [];
    let stack = [root];

    async.whilst(shouldFinish, (whilstCallback)=> {
        let currentDir = stack.pop();

        if (filter(currentDir)) {
            return whilstCallback();
        }

        if (!options.onlyFiles && currentDir != root) {
            addToResults(currentDir);
        }

        fs.readdir(currentDir, (err, files)=> {
            if (err) return whilstCallback(err);
            processListOfFiles(currentDir, files, whilstCallback);
        })

    }, (err)=> {
        callback(err, results);
    });

    function shouldFinish() {
        return stack.length !== 0;
    }

    function addToResults(pathToAdd:string) {
        if (!filter(pathToAdd)) {
            results.push(path.relative(root, pathToAdd));
        }
    }

    function processListOfFiles(currentDir:string, fileList:Array<string>, callback) {
        async.mapSeries(fileList, (file, seriesCallback:(err?)=>any)=> {
            let suspectFile = connectPaths(currentDir, file);

            fs.stat(suspectFile, (err, stat:Stats)=> {
                if (err) return seriesCallback(err);

                if (stat.isDirectory()) {
                    stack.push(suspectFile);
                } else if (suspectFile != root) {
                    addToResults(suspectFile)
                }

                seriesCallback();
            });

        }, callback)
    }

    function connectPaths(directory:string, file:string):string {
        return path.join(directory, file)
    }
}
