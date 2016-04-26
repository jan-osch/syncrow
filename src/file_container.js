/// <reference path="../typescript-interfaces/node.d.ts" />
/// <reference path="../typescript-interfaces/async.d.ts" />
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
var FileContainer = (function (_super) {
    __extends(FileContainer, _super);
    function FileContainer(directoryToWatch) {
        _super.call(this);
        this.directoryToWatch = directoryToWatch;
        this.watchedFiles = {};
        this.writingFiles = {};
        this.beginWatching();
    }
    FileContainer.prototype.getFileTree = function (callback) {
        callback(null, []);
    };
    FileContainer.prototype.computeHashForFileTree = function () {
        this.getFileTree(function (err, fileTree) {
            if (err)
                throw err;
            // fileTree.forEach(this.computeHashForFile);
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
            that.emit(FileContainer.events.fileMetaComputed, that.getMetaDataForFile(fileName));
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
        return this.watchedFiles[fileName];
    };
    FileContainer.prototype.getWriteStreamForFile = function (fileName) {
        var that = this;
        that.writingFiles[fileName] = true;
        return fs.createWriteStream(that.createAbsolutePath(fileName)).on('finish', function () {
            setTimeout(function () {
                that.writingFiles[fileName] = false;
            }, FileContainer.watchTimeout);
        });
    };
    FileContainer.prototype.getReadStreamForFile = function (fileName) {
        return fs.createReadStream(this.createAbsolutePath(fileName));
    };
    FileContainer.prototype.beginWatching = function () {
        var that = this;
        fs.watch(this.directoryToWatch, { recursive: true }).on('change', function (event, fileName) {
            if (event === 'rename') {
                return that.checkRenameEventMeaning(fileName);
            }
            return that.emit(FileContainer.events.fileChanged, fileName);
        });
    };
    FileContainer.prototype.checkRenameEventMeaning = function (fileName) {
        var that = this;
        if (!that.watchedFiles[fileName]) {
            that.watchedFiles[fileName] = {};
            return that.emit(FileContainer.events.fileCreated, fileName);
        }
        fs.stat(that.createAbsolutePath(fileName), function (err) {
            if (err) {
                return that.emit(FileContainer.events.fileDeleted, fileName);
            }
            return that.emit(FileContainer.events.fileChanged, fileName);
        });
    };
    FileContainer.events = {
        fileChanged: 'fileChanged',
        fileDeleted: 'fileDeleted',
        fileCreated: 'fileCreated',
        fileMetaComputed: 'fileMetaComputed'
    };
    FileContainer.watchTimeout = 10;
    return FileContainer;
}(events.EventEmitter));
module.exports = FileContainer;
//# sourceMappingURL=file_container.js.map