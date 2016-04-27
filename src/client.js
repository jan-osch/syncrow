/// <reference path="../typescript-interfaces/node.d.ts" />
"use strict";
var net = require('net');
var SocketMessenger = require('./socket_messenger');
var FileContainer = require("./file_container");
var Client = (function () {
    function Client(directoryToWatch) {
        this.socketMessenger = null;
        this.filesToSync = {};
        this.eventActionMap = {};
        this.fileContainer = this.createDirectoryWatcher(directoryToWatch);
        this.createMapOfKnownEvents();
    }
    Client.prototype.createDirectoryWatcher = function (directoryToWatch) {
        var that = this;
        var fileContainer = new FileContainer(directoryToWatch);
        [FileContainer.events.changed, FileContainer.events.deleted, FileContainer.events.created]
            .forEach(function (eventName) {
            fileContainer.on(eventName, function (eventContent) {
                that.writeEventToSocketMessenger(that.socketMessenger, eventName, eventContent);
            });
        });
        fileContainer.on(FileContainer.events.metaComputed, function (metaData) {
            that.addSyncMetaDataFromOwnContainer(metaData);
        });
        return fileContainer;
    };
    Client.prototype.connect = function (host, port) {
        var _this = this;
        this.socketMessenger = new SocketMessenger(host, port);
        this.socketMessenger.on(SocketMessenger.messageEvent, function (message) { return _this.routeEvent(_this.socketMessenger, message); });
    };
    Client.prototype.syncAfterConnectionReestablished = function () {
        this.fileContainer.recomputeMetaDataForDirectory();
        this.writeEventToSocketMessenger(this.socketMessenger, Client.events.getMeta);
    };
    Client.prototype.addSyncMetaDataFromOtherParty = function (syncData) {
        if (this.filesToSync[syncData.name]) {
            this.compareSyncMetaData(this.filesToSync[syncData.name], syncData);
            delete this.filesToSync[syncData.name];
        }
    };
    Client.prototype.addSyncMetaDataFromOwnContainer = function (syncData) {
        if (this.filesToSync[syncData.name]) {
            this.compareSyncMetaData(syncData, this.filesToSync[syncData.name]);
            delete this.filesToSync[syncData.name];
        }
    };
    Client.prototype.compareSyncMetaData = function (ownMeta, otherPartyMeta) {
        Client.checkMetaDataFileIsTheSame(ownMeta, otherPartyMeta);
        if (otherPartyMeta.hashCode !== ownMeta.hashCode) {
            if (otherPartyMeta.modified.getTime() > ownMeta.modified.getTime()) {
                this.writeEventToSocketMessenger(this.socketMessenger, Client.events.getFile, ownMeta.name);
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
        console.log("got message " + message); // debug
        if (this.eventActionMap[event['type']]) {
            return this.eventActionMap[event['type']](socket, event);
        }
        this.writeEventToSocketMessenger(socket, Client.events.error, 'unknown event type');
    };
    Client.prototype.parseEvent = function (socket, message) {
        try {
            return JSON.parse(message.toString());
        }
        catch (e) {
            this.writeEventToSocketMessenger(socket, Client.events.error, 'bad event');
        }
    };
    Client.createEvent = function (type, body) {
        body = body || {};
        return JSON.stringify({
            type: type,
            body: body
        });
    };
    Client.prototype.writeEventToSocketMessenger = function (socket, type, message) {
        socket.writeData(Client.createEvent(type, message));
    };
    Client.prototype.sendFileToSocket = function (socket, file) {
        var _this = this;
        var fileTransferServer = net.createServer(function (fileTransferSocket) {
            _this.fileContainer.getReadStreamForFile(file).pipe(fileTransferSocket);
        }).listen(function () {
            _this.writeEventToSocketMessenger(socket, Client.events.fileSocket, {
                file: file,
                address: fileTransferServer.address()
            });
        });
    };
    Client.prototype.consumeFileFromNewSocket = function (fileName, address) {
        var _this = this;
        var fileTransferClient = net.connect(address, function () {
            console.log('created new transfer socket');
            fileTransferClient.on('end', function () {
                console.log('finished file transfer');
            });
            _this.fileContainer.consumeFileStream(fileName, fileTransferClient);
        });
    };
    Client.prototype.createMapOfKnownEvents = function () {
        var _this = this;
        this.addEventToKnownMap(Client.events.getFile, function (socket, event) {
            console.log("received a getFile: " + event.body.toString());
            _this.sendFileToSocket(socket, event.body);
        });
        this.addEventToKnownMap(FileContainer.events.created, function (socket, event) {
            console.log("received create event: " + event.body.toString());
            _this.writeEventToSocketMessenger(socket, Client.events.getFile, event.body);
        });
        this.addEventToKnownMap(FileContainer.events.changed, function (socket, event) {
            console.log("received changed event: " + event.body.toString());
            _this.writeEventToSocketMessenger(socket, Client.events.getFile, event.body);
        });
        this.addEventToKnownMap(FileContainer.events.deleted, function (socket, event) {
            console.log("received a delete event: " + event.body.toString());
            _this.fileContainer.deleteFile(event.body);
        });
        this.addEventToKnownMap(Client.events.metaData, function (socket, event) {
            console.log("received metaData: " + event.body.toString());
            _this.addSyncMetaDataFromOtherParty(event.body);
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
        metaData: 'metaData'
    };
    return Client;
}());
module.exports = Client;
//# sourceMappingURL=client.js.map