/// <reference path="../typescript-interfaces/node.d.ts" />
/// <reference path="../typescript-interfaces/async.d.ts" />
"use strict";
var async = require('async');
var fs = require('fs');
var path = require('path');
function readTree(root, options, callback) {
    var results = [];
    var stack = [root];
    async.whilst(shouldFinish, function (whilstCallback) {
        var currentDir = stack.pop();
        if (!options.onlyFiles) {
            results.push(currentDir);
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
    function processListOfFiles(currentDir, fileList, callback) {
        async.mapSeries(fileList, function (file, seriesCallback) {
            var suspectFile = connectPaths(currentDir, file);
            fs.stat(suspectFile, function (err, stat) {
                if (err)
                    return seriesCallback(err);
                if (stat.isDirectory()) {
                    stack.push(suspectFile);
                }
                else {
                    results.push(suspectFile);
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