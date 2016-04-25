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
        var _this = this;
        this.getFileTree(function (err, fileTree) {
            if (err)
                throw err;
            fileTree.forEach(_this.computeHashForFile);
        });
    };
    FileContainer.prototype.computeHashForFile = function (fileName) {
        var _this = this;
        var hash = crypto.createHash('sha256');
        fs.createReadStream(this.createAbsolutePath(fileName)).pipe(hash);
        hash.on('end', function () {
            _this.saveAndEmitComputedHash(fileName, hash);
        });
    };
    FileContainer.prototype.saveAndEmitComputedHash = function (fileName, hash) {
        if (!this.watchedFiles[fileName]) {
            this.watchedFiles[fileName] = {};
        }
        this.watchedFiles[fileName].hashCode = hash.read().toString();
        this.emit(FileContainer.events.fileHashComputed, fileName);
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
            console.log("file changed: " + fileName);
            if (!that.writingFiles[fileName]) {
                that.emit(FileContainer.events.fileChanged, fileName);
            }
        });
    };
    FileContainer.events = {
        fileChanged: 'fileChanged',
        fileHashComputed: 'fileHashComputed'
    };
    FileContainer.watchTimeout = 10;
    return FileContainer;
}(events.EventEmitter));
module.exports = FileContainer;
//# sourceMappingURL=file_container.js.map