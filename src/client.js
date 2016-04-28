/// <reference path="../typings/main.d.ts" />
"use strict";
var net = require('net');
var SocketMessenger = require('./socket_messenger');
var FileContainer = require("./file_container");
var logger = require('./logger');
//TODO add support syncing after reestablishing connection
//TODO add support for deleting offline
//TODO Strategies for offline loading
//TODO add support for cross platform directories
var Client = (function () {
    function Client(directoryToWatch, socketMessenger) {
        this.filesToSync = {};
        this.eventActionMap = {};
        this.fileContainer = this.createDirectoryWatcher(directoryToWatch);
        this.createMapOfKnownEvents();
        this.socketMessenger = this.addSocketMessenger(socketMessenger);
    }
    Client.prototype.createDirectoryWatcher = function (directoryToWatch) {
        var that = this;
        var fileContainer = new FileContainer(directoryToWatch);
        [FileContainer.events.changed, FileContainer.events.deleted, FileContainer.events.created, FileContainer.events.createdDirectory]
            .forEach(function (eventName) {
            fileContainer.on(eventName, function (eventContent) {
                logger.debug("got event: " + eventName); //debug
                Client.writeEventToSocketMessenger(that.socketMessenger, eventName, eventContent);
            });
        });
        fileContainer.on(FileContainer.events.metaComputed, function (metaData) {
            that.addSyncMetaDataFromOwnContainer(metaData);
            Client.writeEventToSocketMessenger(that.socketMessenger, Client.events.metaData, metaData);
        });
        fileContainer.getListOfTrackedFilesAndBeginWatching();
        return fileContainer;
    };
    Client.prototype.addSocketMessenger = function (socketMessenger) {
        var _this = this;
        socketMessenger.on(SocketMessenger.events.message, function (message) { return _this.routeEvent(_this.socketMessenger, message); });
        socketMessenger.on(SocketMessenger.events.connected, function () {
            logger.info('connected with other party beginning to sync');
            _this.syncAfterConnectionReestablished();
        });
        return socketMessenger;
    };
    Client.prototype.syncAfterConnectionReestablished = function () {
        this.fileContainer.recomputeMetaDataForDirectory();
        Client.writeEventToSocketMessenger(this.socketMessenger, Client.events.getMeta);
    };
    Client.prototype.addSyncMetaDataFromOtherParty = function (syncData) {
        if (this.filesToSync[syncData.name]) {
            this.compareSyncMetaData(this.filesToSync[syncData.name], syncData);
            return delete this.filesToSync[syncData.name];
        }
        else if (syncData.hashCode === FileContainer.directoryHashConstant && !this.fileContainer.isFileInContainer(syncData.name)) {
            return this.fileContainer.createDirectory(syncData.name);
        }
        else if (!this.fileContainer.isFileInContainer(syncData.name)) {
            return this.sendGetFileEvent(syncData.name);
        }
    };
    Client.prototype.sendGetFileEvent = function (fileName) {
        Client.writeEventToSocketMessenger(this.socketMessenger, Client.events.getFile, fileName);
    };
    Client.prototype.addSyncMetaDataFromOwnContainer = function (syncData) {
        if (this.filesToSync[syncData.name]) {
            this.compareSyncMetaData(syncData, this.filesToSync[syncData.name]);
            delete this.filesToSync[syncData.name];
        }
    };
    Client.prototype.compareSyncMetaData = function (ownMeta, otherPartyMeta) {
        Client.checkMetaDataFileIsTheSame(ownMeta, otherPartyMeta);
        if (otherPartyMeta.hashCode !== ownMeta.hashCode && ownMeta.hashCode) {
            if (otherPartyMeta.modified.getTime() > ownMeta.modified.getTime()) {
                this.sendGetFileEvent(ownMeta.name);
            }
        }
    };
    Client.checkMetaDataFileIsTheSame = function (ownMeta, otherPartyMeta) {
        if (ownMeta.name !== otherPartyMeta.name) {
            throw new Error('comparing not matching metadata');
        }
    };
    Client.prototype.routeEvent = function (socket, message) {
        var event = this.parseEvent(socket, message);
        if (!event)
            return;
        if (this.eventActionMap[event['type']]) {
            return this.eventActionMap[event['type']](socket, event);
        }
        Client.writeEventToSocketMessenger(socket, Client.events.error, "unknown event type: " + event.type);
    };
    Client.prototype.parseEvent = function (socket, message) {
        try {
            return JSON.parse(message.toString());
        }
        catch (e) {
            Client.writeEventToSocketMessenger(socket, Client.events.error, 'bad event');
        }
    };
    Client.createEvent = function (type, body) {
        body = body || {};
        return JSON.stringify({
            type: type,
            body: body
        });
    };
    Client.writeEventToSocketMessenger = function (socket, type, message) {
        logger.debug("writing to socket event: " + type + " with body: " + JSON.stringify(message));
        socket.writeData(Client.createEvent(type, message));
    };
    Client.prototype.sendFileToSocket = function (socket, file) {
        var _this = this;
        var fileTransferServer = net.createServer(function (fileTransferSocket) {
            _this.fileContainer.getReadStreamForFile(file).pipe(fileTransferSocket);
        }).listen(function () {
            var address = fileTransferServer.address();
            address.host = _this.socketMessenger.getOwnHost();
            Client.writeEventToSocketMessenger(socket, Client.events.fileSocket, {
                file: file,
                address: address
            });
        });
    };
    Client.prototype.createMapOfKnownEvents = function () {
        this.addClientEvents();
        this.addFileContainerEvents();
    };
    Client.prototype.addClientEvents = function () {
        var _this = this;
        this.addEventToKnownMap(Client.events.getFile, function (socket, event) {
            logger.debug("received a getFile: " + JSON.stringify(event.body));
            _this.sendFileToSocket(socket, event.body);
        });
        this.addEventToKnownMap(Client.events.metaData, function (socket, event) {
            logger.debug("received metaData: " + JSON.stringify(event.body));
            _this.addSyncMetaDataFromOtherParty(event.body);
        });
        this.addEventToKnownMap(Client.events.getMeta, function (socket, event) {
            logger.debug("received getMeta: " + JSON.stringify(event.body));
            _this.fileContainer.recomputeMetaDataForDirectory();
        });
        this.addEventToKnownMap(Client.events.fileSocket, function (socket, event) {
            logger.debug("received fileSocket: " + JSON.stringify(event.body));
            _this.consumeFileFromNewSocket(event.body.file, event.body.address);
        });
        this.addEventToKnownMap(Client.events.error, function (socket, event) {
            logger.debug("received error message " + JSON.stringify(event.body));
        });
    };
    Client.prototype.addFileContainerEvents = function () {
        var _this = this;
        this.addEventToKnownMap(FileContainer.events.created, function (socket, event) {
            logger.debug("received create event: " + JSON.stringify(event.body));
            Client.writeEventToSocketMessenger(socket, Client.events.getFile, event.body);
        });
        this.addEventToKnownMap(FileContainer.events.createdDirectory, function (socket, event) {
            logger.debug("received create event: " + JSON.stringify(event.body));
            _this.fileContainer.createDirectory(event.body);
        });
        this.addEventToKnownMap(FileContainer.events.changed, function (socket, event) {
            logger.debug("received changed event: " + JSON.stringify(event.body));
            Client.writeEventToSocketMessenger(socket, Client.events.getFile, event.body);
        });
        this.addEventToKnownMap(FileContainer.events.deleted, function (socket, event) {
            logger.debug("received a delete event: " + JSON.stringify(event.body));
            _this.fileContainer.deleteFile(event.body);
        });
    };
    Client.prototype.consumeFileFromNewSocket = function (fileName, address) {
        var _this = this;
        var fileTransferClient = net.connect(address, function () {
            logger.info("created new transfer socket, file: " + fileName);
            console.time(fileName + ' transfer');
            fileTransferClient.on('end', function () {
                logger.info("finished file transfer, file: " + fileName);
                console.timeEnd(fileName + ' transfer');
            });
            _this.fileContainer.consumeFileStream(fileName, fileTransferClient);
        });
    };
    Client.prototype.addEventToKnownMap = function (key, listener) {
        this.eventActionMap[key] = listener;
    };
    Client.events = {
        error: 'error',
        fileSocket: 'fileSocket',
        getFile: 'getFile',
        getMeta: 'getMeta',
        metaData: 'metaData',
        createDirectory: 'createDirectory'
    };
    return Client;
}());
module.exports = Client;
//# sourceMappingURL=client.js.map