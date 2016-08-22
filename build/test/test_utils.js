var net = require("net");
var mkdirp = require("mkdirp");
var async = require("async");
var fs = require("fs");
var rimraf = require("rimraf");
var path = require("path");
var read_tree_1 = require("../fs_helpers/read_tree");
/**
 * @returns {Function} a cleanup function that will close the server and paired sockets
 * @param doneCallback
 */
function obtainTwoSockets(doneCallback) {
    var clientSocket;
    var server;
    var port = 3124; //A constant port is used to ensure that the cleanup function is called
    var listener = function (socket) {
        return doneCallback(null, { client: clientSocket, server: socket });
    };
    async.series([
        function (callback) {
            server = net.createServer(listener).listen(port, callback);
        },
        function (callback) {
            clientSocket = net.connect({ port: port }, callback);
        }
    ], function (err) {
        if (err)
            return doneCallback(err);
    });
    return function () {
        clientSocket.end();
        server.close();
    };
}
exports.obtainTwoSockets = obtainTwoSockets;
/**
 * @param path
 * @param content
 * @param directory
 * @param doneCallback
 */
function createPath(path, content, directory, doneCallback) {
    if (directory) {
        return createDir(path, doneCallback);
    }
    return fs.writeFile(path, content, doneCallback);
}
exports.createPath = createPath;
/**
 * @param files
 * @param doneCallback
 */
function createPathSeries(files, doneCallback) {
    async.eachSeries(files, function (file, callback) { return createPath(file.path, file.content, file.directory, callback); }, doneCallback);
}
exports.createPathSeries = createPathSeries;
/**
 * @param path
 * @returns {boolean}
 */
function pathExists(path) {
    try {
        fs.accessSync(path);
        return true;
    }
    catch (e) {
        return false;
    }
}
exports.pathExists = pathExists;
/**
 * @param firstFilePath
 * @param secondFilePath
 * @param doneCallback
 */
function compareTwoFiles(firstFilePath, secondFilePath, doneCallback) {
    async.parallel({
        first: function (callback) { return fs.readFile(firstFilePath, callback); },
        second: function (callback) { return fs.readFile(secondFilePath, callback); }
    }, doneCallback);
}
exports.compareTwoFiles = compareTwoFiles;
/**
 * @param dirPath
 * @param doneCallback
 */
function createDir(dirPath, doneCallback) {
    mkdirp(dirPath, doneCallback);
}
exports.createDir = createDir;
/**
 * @param path
 * @param callback
 */
function removePath(path, callback) {
    rimraf(path, callback);
}
exports.removePath = removePath;
/**
 * @param length
 * @returns {string}
 */
function getRandomString(length) {
    var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var result = '';
    function getRandomChar() {
        var position = Math.floor(Math.random() * chars.length);
        return chars.charAt(position);
    }
    while (length > 0) {
        length--;
        result += getRandomChar();
    }
    return result;
}
exports.getRandomString = getRandomString;
/**
 * @param pathA
 * @param pathB
 * @param callback
 */
function compareDirectories(pathA, pathB, callback) {
    return async.waterfall([
        function (seriesCallback) {
            return async.parallel({
                pathA: function (cb) { return read_tree_1.readTree(pathA, {}, cb); },
                pathB: function (cb) { return read_tree_1.readTree(pathB, {}, cb); }
            }, seriesCallback);
        },
        function (results, seriesCallback) { return compareFileTrees(pathA, results.pathA, pathB, results.pathB, seriesCallback); }
    ], callback);
}
exports.compareDirectories = compareDirectories;
function compareFileTrees(pathA, filesA, pathB, filesB, callback) {
    if (filesA.length !== filesB.length) {
        return callback(new Error("File trees are not matching - " + filesA.length + " and " + filesB.length));
    }
    return async.each(filesA, function (file, cb) {
        var firstFilePath = path.join(pathA, file);
        var secondFilePath = path.join(pathB, file);
        return compareTwoFiles(firstFilePath, secondFilePath, function (err, results) {
            if (err)
                return cb(err);
            return compareFileContents(firstFilePath, results.first, secondFilePath, results.second, cb);
        });
    }, callback);
}
function compareFileContents(pathA, contentA, pathB, contentB, callback) {
    if (Buffer.isBuffer(contentA) && Buffer.isBuffer(contentB)) {
        if (!contentA.compare(contentB) === 0) {
            return setImmediate(callback, new Error("File contents " + pathA + " and " + pathB + " (Buffers) do not match "));
        }
    }
    var doesContentMatch = contentA === contentB;
    if (!doesContentMatch)
        return setImmediate(callback, new Error("File contents " + pathA + " and " + pathB + " (Strings) do not match"));
    return setImmediate(callback);
}
//# sourceMappingURL=test_utils.js.map