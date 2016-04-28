/// <reference path="../typings/main.d.ts" />

import async = require('async');
import  fs = require('fs');
import path = require('path');
import {Stats} from "fs";


function readTree(root:string, options:{excluded?:Array<string>; onlyFiles?:boolean;},
                  callback:(err:Error, result:Array<string>)=>any) {

    let results = [];
    let stack = [root];

    async.whilst(shouldFinish, (whilstCallback)=> {
        let currentDir = stack.pop();

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

    function addToResults(pathToAdd:string){
        results.push(path.relative(root,pathToAdd));
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

export = readTree;