var async = require("async");
var fs = require("fs");
var crypto = require("crypto");
var logger_1 = require("../utils/logger");
var debug = logger_1.debugFor('syncrow:fs:file_meta_queue');
var FileMetaComputingQueue = (function () {
    /**
     * Used for computing SyncData
     * @param queueSize
     * @param basePath
     */
    function FileMetaComputingQueue(queueSize, basePath) {
        this.queue = async.queue(function (task, callback) { return task(callback); }, queueSize);
        this.basePath = basePath;
    }
    /**
     * @param fileName
     * @param doneCallback
     */
    FileMetaComputingQueue.prototype.computeFileMeta = function (fileName, doneCallback) {
        var _this = this;
        debug("computing file meta for file: " + fileName);
        var job = function (callback) {
            var result = {
                name: fileName,
                exists: false,
                modified: null,
                isDirectory: false,
                hashCode: ''
            };
            async.waterfall([
                function (waterfallCallback) { return _this.checkIfExistsAndIsDirectory(result, waterfallCallback); },
                function (partial, waterfallCallback) { return _this.computeHashForFile(partial, waterfallCallback); }
            ], function (err, result) {
                if (err) {
                    doneCallback(err);
                    return callback();
                }
                doneCallback(null, result);
                return callback();
            });
        };
        this.queue.push(job);
    };
    FileMetaComputingQueue.prototype.checkIfExistsAndIsDirectory = function (syncData, callback) {
        fs.stat(this.basePath + "/" + syncData.name, function (err, stats) {
            if (err) {
                syncData.exists = false;
                return callback(null, syncData);
            }
            syncData.exists = true;
            syncData.modified = stats.mtime;
            if (stats.isDirectory()) {
                syncData.isDirectory = true;
            }
            return callback(null, syncData);
        });
    };
    FileMetaComputingQueue.prototype.computeHashForFile = function (syncData, callback) {
        if (!this.shouldComputeHash(syncData)) {
            return callback(null, syncData);
        }
        var hash = crypto.createHash('sha256');
        var stream = fs.createReadStream(this.basePath + "/" + syncData.name).pipe(hash);
        hash.on('error', function (err) {
            callback(err);
        });
        hash.on('finish', function () {
            syncData.hashCode = hash.read().toString('hex');
            callback(null, syncData);
        });
    };
    FileMetaComputingQueue.prototype.shouldComputeHash = function (syncData) {
        return (syncData.exists && !syncData.isDirectory);
    };
    return FileMetaComputingQueue;
})();
exports.FileMetaComputingQueue = FileMetaComputingQueue;
//# sourceMappingURL=file_meta_queue.js.map