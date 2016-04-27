/// <reference path="../typescript-interfaces/node.d.ts" />
/// <reference path="../typescript-interfaces/async.d.ts" />
/// <reference path="../typescript-interfaces/rimraf.d.ts" />
"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var fs = require('fs');
var events = require('events');
var async = require('async');
var crypto = require('crypto');
var path = require('path');
var readTree = require('./read_tree');
var rimraf = require('rimraf');
//TODO add support for different parent directory names
var FileContainer = (function (_super) {
    __extends(FileContainer, _super);
    function FileContainer(directoryToWatch) {
        _super.call(this);
        this.directoryToWatch = directoryToWatch;
        this.watchedFiles = {};
        this.blockedFiles = {};
        this.computeMetaAndBeginWatching();
    }
    FileContainer.prototype.computeMetaAndBeginWatching = function () {
        var that = this;
        this.getFileTree(function (err, files) {
            files.forEach(function (file) {
                that.watchedFiles[file] = {};
            });
            that.beginWatching();
        });
    };
    FileContainer.prototype.getListOfWatchedFiles = function () {
        return Object.keys(this.watchedFiles);
    };
    FileContainer.prototype.getFileTree = function (callback) {
        readTree(this.directoryToWatch, {}, callback);
    };
    FileContainer.prototype.recomputeMetaDataForDirectory = function () {
        var that = this;
        this.getFileTree(function (err, files) {
            files.forEach(that.computeFileMetaDataAndEmit, that);
        });
    };
    FileContainer.prototype.computeFileMetaDataAndEmit = function (fileName) {
        var that = this;
        async.parallel([function (parallelCallback) {
                that.computeHashForFile(fileName, parallelCallback);
            }, function (parallelCallback) {
                that.getModifiedDateForFile(fileName, parallelCallback);
            }], function (err) {
            if (err)
                return console.error(err);
            that.emit(FileContainer.events.metaComputed, that.getMetaDataForFile(fileName));
        });
    };
    FileContainer.prototype.computeHashForFile = function (fileName, callback) {
        var _this = this;
        var hash = crypto.createHash('sha256');
        fs.createReadStream(this.createAbsolutePath(fileName)).pipe(hash);
        hash.on('end', function () {
            _this.saveWatchedFileProperty(fileName, 'hashCode', hash.read().toString());
            callback();
        });
    };
    FileContainer.prototype.getModifiedDateForFile = function (fileName, callback) {
        var _this = this;
        fs.stat(this.createAbsolutePath(fileName), function (error, stats) {
            if (error)
                return callback(error);
            _this.saveWatchedFileProperty(fileName, 'modifiedDate', stats.mtime);
            callback();
        });
    };
    FileContainer.prototype.saveWatchedFileProperty = function (fileName, key, value) {
        if (!this.watchedFiles[fileName]) {
            this.watchedFiles[fileName] = {};
        }
        this.watchedFiles[fileName][key] = value;
    };
    FileContainer.prototype.createAbsolutePath = function (file) {
        return path.join(this.directoryToWatch, file);
    };
    FileContainer.prototype.getMetaDataForFile = function (fileName) {
        return {
            modified: this.watchedFiles[fileName].modifiedDate,
            hashCode: this.watchedFiles[fileName].hashCode,
            name: fileName
        };
    };
    FileContainer.prototype.deleteFile = function (fileName) {
        var _this = this;
        this.blockedFiles[fileName] = true;
        rimraf(fileName, function (error) {
            if (error)
                return console.error(error);
            setTimeout(function () {
                delete _this.blockedFiles[fileName];
            }, FileContainer.watchTimeout);
        });
    };
    FileContainer.prototype.consumeFileStream = function (fileName, readStream) {
        var that = this;
        that.blockedFiles[fileName] = true;
        var writeStream = fs.createWriteStream(that.createAbsolutePath(fileName)).on('finish', function () {
            setTimeout(function () {
                delete that.blockedFiles[fileName];
            }, FileContainer.watchTimeout);
        });
        readStream.pipe(writeStream);
    };
    FileContainer.prototype.getReadStreamForFile = function (fileName) {
        return fs.createReadStream(this.createAbsolutePath(fileName));
    };
    FileContainer.prototype.beginWatching = function () {
        var that = this;
        fs.watch(this.directoryToWatch, { recursive: true }).on('change', function (event, fileName) {
            var fullFileName = that.createAbsolutePath(fileName);
            if (event === 'rename')
                return that.checkRenameEventMeaning(fullFileName);
            return that.emitEventIfFileNotBlocked(FileContainer.events.changed, fullFileName);
        });
    };
    FileContainer.prototype.checkRenameEventMeaning = function (fullFileName) {
        var that = this;
        if (!that.watchedFiles[fullFileName]) {
            that.watchedFiles[fullFileName] = {};
            return that.emitEventIfFileNotBlocked(FileContainer.events.created, fullFileName);
        }
        fs.stat(that.createAbsolutePath(fullFileName), function (err) {
            if (err) {
                delete that.watchedFiles[fullFileName];
                return that.emitEventIfFileNotBlocked(FileContainer.events.deleted, fullFileName);
            }
            return that.emitEventIfFileNotBlocked(FileContainer.events.changed, fullFileName);
        });
    };
    FileContainer.prototype.emitEventIfFileNotBlocked = function (event, fullFileName) {
        if (!this.blockedFiles[fullFileName]) {
            this.emit(event, fullFileName);
        }
    };
    FileContainer.events = {
        changed: 'changed',
        deleted: 'deleted',
        created: 'created',
        metaComputed: 'metaComputed'
    };
    FileContainer.watchTimeout = 10;
    return FileContainer;
}(events.EventEmitter));
module.exports = FileContainer;
//# sourceMappingURL=file_container.js.map