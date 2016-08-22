var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var fs = require("fs");
var path = require("path");
var events_1 = require("events");
var logger_1 = require("../utils/logger");
var path_helper_1 = require("./path_helper");
var file_meta_queue_1 = require("./file_meta_queue");
var read_tree_1 = require("./read_tree");
var rimraf = require("rimraf");
var mkdirp = require("mkdirp");
var chokidar = require("chokidar");
var debug = logger_1.debugFor("syncrow:file_container");
var logger = logger_1.loggerFor('FileContainer');
var WATCH_TIMEOUT = 400;
var TRANSFER_FILE_LIMIT = 1000;
var FileContainer = (function (_super) {
    __extends(FileContainer, _super);
    /**
     * Wrapper over filesystem
     * @param directoryToWatch
     * @param options
     */
    function FileContainer(directoryToWatch, options) {
        if (options === void 0) { options = {}; }
        _super.call(this);
        var fileLimit = options.fileLimit ? options.fileLimit : TRANSFER_FILE_LIMIT;
        this.filterFunction = options.filter ? options.filter : function (s) { return false; };
        this.watchTimeout = options.timeout ? options.timeout : WATCH_TIMEOUT;
        this.directoryToWatch = directoryToWatch;
        this.blockedFiles = new Set();
        this.cachedSyncData = new Map();
        this.fileMetaQueue = new file_meta_queue_1.FileMetaComputingQueue(fileLimit, this.directoryToWatch);
    }
    /**
     * Stops watching the directory
     */
    FileContainer.prototype.shutdown = function () {
        debug('closing file container watcher');
        this.watcher.close();
    };
    /**
     * @param directoryName
     * @param callback
     */
    FileContainer.prototype.createDirectory = function (directoryName, callback) {
        var _this = this;
        logger.info("creating directory: " + directoryName);
        this.blockFile(directoryName);
        return mkdirp(this.createAbsolutePath(directoryName), function (error) {
            _this.unBlockFileWithTimeout(directoryName);
            FileContainer.passErrorIfCallbackIsPresentLogOtherwise(error, callback);
        });
    };
    /**
     * @param callback
     */
    FileContainer.prototype.getFileTree = function (callback) {
        debug("obtaining file tree");
        read_tree_1.readTree(this.directoryToWatch, { filter: this.filterFunction }, function (err, results) {
            if (err)
                return callback(err);
            var fileTree = results.map(path_helper_1.PathHelper.normalizePath);
            debug("detected files: " + fileTree.length);
            callback(null, fileTree);
        });
    };
    /**
     * @param fileName
     * @param callback
     */
    FileContainer.prototype.deleteFile = function (fileName, callback) {
        var _this = this;
        logger.info("deleting file: " + fileName);
        this.blockFile(fileName);
        rimraf(this.createAbsolutePath(fileName), function (error) {
            _this.unBlockFileWithTimeout(fileName);
            FileContainer.passErrorIfCallbackIsPresentLogOtherwise(error, callback);
        });
    };
    /**
     *
     * @param fileName
     * @param readStream
     * @param callback
     */
    FileContainer.prototype.consumeFileStream = function (fileName, readStream, callback) {
        var _this = this;
        try {
            debug("starting to read from remote - file " + fileName + " is blocked now");
            this.blockFile(fileName);
            var writeStream = fs.createWriteStream(this.createAbsolutePath(fileName));
            writeStream.on('finish', function () { return _this.unBlockFileWithTimeout(fileName); });
            writeStream.on('finish', callback);
            readStream.pipe(writeStream).on('error', callback);
        }
        catch (error) {
            callback(error);
        }
    };
    /**
     * @param fileName
     * @returns {ReadStream}
     */
    FileContainer.prototype.getReadStreamForFile = function (fileName) {
        try {
            return fs.createReadStream(this.createAbsolutePath(fileName)).on('error', function (error) {
                logger.warn("/getReadStreamForFile - could not open a read stream, reason: " + error);
            });
        }
        catch (error) {
            logger.warn("/getReadStreamForFile - could not open a read stream, reason: " + error);
        }
    };
    /**
     * Starts watching and emitting messages
     * @param callback
     */
    FileContainer.prototype.beginWatching = function (callback) {
        var _this = this;
        this.watcher = chokidar.watch(path.resolve(this.directoryToWatch), {
            persistent: true,
            ignoreInitial: true,
            usePolling: true,
            cwd: this.directoryToWatch,
            ignored: this.filterFunction
        });
        debug("beginning to watch a directory: " + this.directoryToWatch);
        this.watcher.on('add', function (path) { return _this.emitEventIfFileNotBlocked(FileContainer.events.fileCreated, path); });
        this.watcher.on('change', function (path) { return _this.emitEventIfFileNotBlocked(FileContainer.events.changed, path); });
        this.watcher.on('unlink', function (path) { return _this.emitEventIfFileNotBlocked(FileContainer.events.deleted, path); });
        this.watcher.on('addDir', function (path) { return _this.emitEventIfFileNotBlocked(FileContainer.events.createdDirectory, path); });
        this.watcher.on('unlinkDir', function (path) { return _this.emitEventIfFileNotBlocked(FileContainer.events.deleted, path); });
        this.watcher.on('ready', function () {
            debug("initial scan ready - watching " + Object.keys(_this.watcher.getWatched()).length + " directories");
            callback();
        });
        this.watcher.on('error', function (err) {
            logger.error("watcher emitted: " + err);
            callback(err);
        });
    };
    /**
     * @param fileName
     * @param callback
     */
    FileContainer.prototype.getFileMeta = function (fileName, callback) {
        var _this = this;
        if (this.cachedSyncData.has(fileName)) {
            debug("found cached sync data for file " + fileName);
            return callback(null, this.cachedSyncData.get(fileName));
        }
        this.fileMetaQueue.computeFileMeta(fileName, function (err, syncData) {
            if (!err && syncData)
                _this.cachedSyncData.set(fileName, syncData);
            return callback(err, syncData);
        });
    };
    FileContainer.prototype.createAbsolutePath = function (file) {
        return path_helper_1.PathHelper.normalizePath(path.join(this.directoryToWatch, file));
    };
    FileContainer.prototype.blockFile = function (fileName) {
        this.blockedFiles.add(fileName);
    };
    FileContainer.prototype.unBlockFileWithTimeout = function (fileName) {
        var _this = this;
        if (!this.blockedFiles.has(fileName))
            return logger.error("Attempting to unblock a file that is not blocked: " + fileName);
        setTimeout(function () {
            debug("unblocking file: " + fileName);
            _this.blockedFiles.delete(fileName);
        }, this.watchTimeout);
    };
    FileContainer.prototype.emitEventIfFileNotBlocked = function (event, fullFileName) {
        debug("could emit " + event + " for " + fullFileName);
        if (!this.blockedFiles.has(fullFileName)) {
            debug("emitting " + event + " for file: " + fullFileName);
            this.emit(event, fullFileName);
        }
    };
    FileContainer.passErrorIfCallbackIsPresentLogOtherwise = function (error, callback) {
        if (error) {
            if (callback)
                return callback(error);
            return logger.error(error);
        }
        if (callback)
            return callback();
    };
    FileContainer.events = {
        changed: 'changed',
        deleted: 'deleted',
        fileCreated: 'fileCreated',
        createdDirectory: 'createdDirectory',
    };
    return FileContainer;
})(events_1.EventEmitter);
exports.FileContainer = FileContainer;
//# sourceMappingURL=file_container.js.map