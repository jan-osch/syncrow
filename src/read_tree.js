/// <reference path="../typings/main.d.ts" />
"use strict";
var async = require('async');
var fs = require('fs');
var path = require('path');
function readTree(root, options, callback) {
    var results = [];
    var stack = [root];
    async.whilst(shouldFinish, function (whilstCallback) {
        var currentDir = stack.pop();
        if (!options.onlyFiles && currentDir != root) {
            addToResults(currentDir);
        }
        fs.readdir(currentDir, function (err, files) {
            if (err)
                return whilstCallback(err);
            processListOfFiles(currentDir, files, whilstCallback);
        });
    }, function (err) {
        callback(err, results);
    });
    function shouldFinish() {
        return stack.length !== 0;
    }
    function addToResults(pathToAdd) {
        results.push(path.relative(root, pathToAdd));
    }
    function processListOfFiles(currentDir, fileList, callback) {
        async.mapSeries(fileList, function (file, seriesCallback) {
            var suspectFile = connectPaths(currentDir, file);
            fs.stat(suspectFile, function (err, stat) {
                if (err)
                    return seriesCallback(err);
                if (stat.isDirectory()) {
                    stack.push(suspectFile);
                }
                else if (suspectFile != root) {
                    addToResults(suspectFile);
                }
                seriesCallback();
            });
        }, callback);
    }
    function connectPaths(directory, file) {
        return path.join(directory, file);
    }
}
module.exports = readTree;
//# sourceMappingURL=read_tree.js.map