var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var logger_1 = require("../utils/logger");
var file_container_1 = require("../fs_helpers/file_container");
var callback_helper_1 = require("../connection/callback_helper");
var transfer_helper_1 = require("../transport/transfer_helper");
var event_messenger_1 = require("../connection/event_messenger");
var events_1 = require("events");
var no_action_1 = require("../sync/no_action");
var debug = logger_1.debugFor("syncrow:engine");
var logger = logger_1.loggerFor('Engine');
var Engine = (function (_super) {
    __extends(Engine, _super);
    function Engine(fileContainer, transferHelper, options) {
        _super.call(this);
        this.fileContainer = fileContainer;
        this.transferHelper = transferHelper;
        this.options = options;
        this.options.sync = this.options.sync ? this.options.sync : no_action_1.noAction;
        this.callbackHelper = new callback_helper_1.CallbackHelper();
        this.otherParties = [];
        this.addListenersToFileContainer(this.fileContainer);
    }
    /**
     * @param otherParty
     */
    Engine.prototype.addOtherPartyMessenger = function (otherParty) {
        var _this = this;
        this.otherParties.push(otherParty);
        var syncParams = { remoteParty: otherParty, container: this.fileContainer, subject: this };
        otherParty.on(event_messenger_1.EventMessenger.events.died, function () {
            debug("lost connection with remote party - permanently");
            _this.removeOtherParty(otherParty);
        });
        this.options.sync(syncParams, function (err) {
            if (err)
                return logger.error(err);
            return logger.info("Synced successfully on first connection");
        });
        this.addEngineListenersToOtherParty(otherParty);
    };
    /**
     * Stops engine activity
     */
    Engine.prototype.shutdown = function () {
        var _this = this;
        this.emit(Engine.events.shutdown);
        this.otherParties.forEach(function (otherParty) { return _this.removeOtherParty(otherParty); });
        this.fileContainer.shutdown();
    };
    /**
     * @param otherParty
     */
    Engine.prototype.removeOtherParty = function (otherParty) {
        otherParty.shutdown();
        var index = this.otherParties.indexOf(otherParty);
        this.otherParties.splice(index, 1);
    };
    /**
     * @param otherParty
     * @param fileName
     */
    Engine.prototype.deleteRemoteFile = function (otherParty, fileName) {
        return otherParty.send(Engine.messages.fileDeleted, { fileName: fileName });
    };
    /**
     * @param otherParty
     * @param fileName
     * @param callback
     */
    Engine.prototype.pushFileToRemote = function (otherParty, fileName, callback) {
        this.transferHelper.sendFileToRemote(otherParty, fileName, callback);
    };
    /**
     * @param otherParty
     * @param fileName
     */
    Engine.prototype.createRemoteDirectory = function (otherParty, fileName) {
        return otherParty.send(Engine.messages.directoryCreated, { fileName: fileName });
    };
    /**
     * @param otherParty
     * @param fileName
     * @param callback
     */
    Engine.prototype.getRemoteFileMeta = function (otherParty, fileName, callback) {
        var id = this.callbackHelper.addCallback(callback);
        otherParty.send(Engine.messages.getMetaForFile, { fileName: fileName, id: id });
    };
    /**
     * @param otherParty
     * @param callback
     */
    Engine.prototype.getRemoteFileList = function (otherParty, callback) {
        var id = this.callbackHelper.addCallback(callback);
        otherParty.send(Engine.messages.getFileList, { id: id });
    };
    /**
     * @param otherParty
     * @param fileName
     * @param callback
     */
    Engine.prototype.requestRemoteFile = function (otherParty, fileName, callback) {
        this.transferHelper.getFileFromRemote(otherParty, fileName, callback);
    };
    Engine.prototype.addEngineListenersToOtherParty = function (otherParty) {
        var _this = this;
        otherParty.on(event_messenger_1.EventMessenger.events.error, function (event) {
            return logger.error("received error message " + JSON.stringify(event.body));
        });
        otherParty.on(transfer_helper_1.TransferHelper.outerEvent, function (event) { return _this.transferHelper.consumeMessage(event.body, otherParty); });
        otherParty.on(Engine.messages.metaDataForFile, function (event) { return _this.callbackHelper.getCallback(event.body.id)(null, event.body.syncData); });
        otherParty.on(Engine.messages.fileList, function (event) { return _this.callbackHelper.getCallback(event.body.id)(null, event.body.fileList); });
        otherParty.on(Engine.messages.directoryCreated, function (event) {
            _this.fileContainer.createDirectory(event.body.fileName);
            debug("finished creating a new directory: " + event.body.fileName + " - emitting newDirectory event");
            _this.emit(Engine.events.newDirectory, event.body.fileName);
            return _this.broadcastEvent(event.type, { fileName: event.body.fileName }, otherParty);
        });
        otherParty.on(Engine.messages.fileDeleted, function (event) {
            _this.fileContainer.deleteFile(event.body.fileName);
            _this.emit(Engine.events.deletedPath, event.body.fileName);
            return _this.broadcastEvent(event.type, event.body, otherParty);
        });
        otherParty.on(Engine.messages.fileChanged, function (event) {
            return _this.requestRemoteFile(otherParty, event.body.fileName, function () {
                debug("finished downloading a file: " + event.body.fileName + " - emitting changedFile event");
                _this.emit(Engine.events.changedFile, event.body.fileName);
                return _this.broadcastEvent(event.type, event.body, otherParty);
            });
        });
        otherParty.on(Engine.messages.getFileList, function (event) {
            return _this.fileContainer.getFileTree(function (err, fileList) {
                if (err) {
                    return logger.error(err);
                }
                return otherParty.send(Engine.messages.fileList, { fileList: fileList, id: event.body.id });
            });
        });
        otherParty.on(Engine.messages.getMetaForFile, function (event) {
            return _this.fileContainer.getFileMeta(event.body.fileName, function (err, syncData) {
                if (err) {
                    return logger.error(err);
                }
                return otherParty.send(Engine.messages.metaDataForFile, { syncData: syncData, id: event.body.id });
            });
        });
    };
    Engine.prototype.addListenersToFileContainer = function (fileContainer) {
        var _this = this;
        fileContainer.on(file_container_1.FileContainer.events.changed, function (eventContent) {
            debug("detected file changed: " + eventContent);
            return _this.broadcastEvent(Engine.messages.fileChanged, { fileName: eventContent });
        });
        fileContainer.on(file_container_1.FileContainer.events.fileCreated, function (eventContent) {
            debug("detected file created: " + eventContent);
            return _this.broadcastEvent(Engine.messages.fileChanged, { fileName: eventContent });
        });
        fileContainer.on(file_container_1.FileContainer.events.deleted, function (eventContent) {
            debug("detected file deleted: " + eventContent);
            return _this.broadcastEvent(Engine.messages.fileDeleted, { fileName: eventContent });
        });
        fileContainer.on(file_container_1.FileContainer.events.createdDirectory, function (eventContent) {
            return _this.broadcastEvent(Engine.messages.directoryCreated, { fileName: eventContent });
        });
    };
    Engine.prototype.broadcastEvent = function (eventType, body, excludeParty) {
        this.otherParties.forEach(function (otherParty) {
            if (excludeParty && excludeParty === otherParty) {
                return;
            }
            return otherParty.send(eventType, body);
        });
    };
    //TODO add newFile support
    Engine.events = {
        error: 'error',
        newFile: 'newFile',
        changedFile: 'changedFile',
        deletedPath: 'deletedPath',
        synced: 'synced',
        shutdown: 'shutdown',
        newDirectory: 'newDirectory'
    };
    Engine.messages = {
        fileChanged: 'fileChanged',
        fileCreated: 'fileCreated',
        fileDeleted: 'fileDeleted',
        directoryCreated: 'directoryCreated',
        getFileList: 'getFileList',
        getMetaForFile: 'getMetaTupleForFile',
        metaDataForFile: 'metaDataForFile',
        fileList: 'fileList'
    };
    return Engine;
})(events_1.EventEmitter);
exports.Engine = Engine;
//# sourceMappingURL=engine.js.map