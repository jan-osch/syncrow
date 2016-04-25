/// <reference path="../typescript-interfaces/node.d.ts" />
"use strict";
var fs = require('fs');
var net = require('net');
var SocketMessenger = require('./socket_messenger');
var Client = (function () {
    function Client(directoryToWatch) {
        this.directoryToWatch = directoryToWatch;
        this.socketMessenger = null;
        this.eventActionMap = {};
        this.createDirectoryWatcher(directoryToWatch);
        this.createMapOfKnownEvents();
    }
    Client.prototype.createDirectoryWatcher = function (directoryToWatch) {
        var _this = this;
        return fs.watch(directoryToWatch, { recursive: true }).on('change', function (event, fileName) {
            console.log("file changed: " + fileName);
            _this.emitFileChanged(fileName);
        });
    };
    Client.prototype.emitFileChanged = function (fileName) {
        this.writeEventToSocketMessenger(this.socketMessenger, Client.events.changed, fileName);
    };
    Client.prototype.connect = function (host, port) {
        var _this = this;
        this.socketMessenger = new SocketMessenger(host, port);
        this.socketMessenger.on(SocketMessenger.messageEvent, function (message) { return _this.routeEvent(_this.socketMessenger, message); });
    };
    Client.prototype.routeEvent = function (socket, message) {
        var event = this.parseEvent(socket, message);
        if (!event)
            return;
        console.log("got message " + message);
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
            fs.createReadStream(_this.createAbsolutePath(file)).pipe(fileTransferSocket);
        }).listen(function () {
            _this.writeEventToSocketMessenger(socket, Client.events.fileSocket, {
                file: file,
                address: fileTransferServer.address()
            });
        });
    };
    Client.prototype.createAbsolutePath = function (file) {
        return this.directoryToWatch + "/" + file;
    };
    Client.prototype.consumeFileFromNewSocket = function (fileName, address) {
        var _this = this;
        var fileTransferClient = net.connect(address, function () {
            console.log('created new transfer socket');
            fileTransferClient.on('end', function () {
                console.log('finished file transfer');
            });
            fileTransferClient.pipe(fs.createWriteStream(_this.createAbsolutePath(fileName)));
        });
    };
    Client.prototype.createMapOfKnownEvents = function () {
        var _this = this;
        this.addEventToKnownMap(Client.events.getFile, function (socket, event) {
            console.log("received a getFile: " + event.body.toString());
            _this.sendFileToSocket(socket, event.body);
        });
        this.addEventToKnownMap(Client.events.changed, function (socket, event) {
            console.log("received a changed: " + event.body.toString());
            _this.writeEventToSocketMessenger(socket, Client.events.getFile, event.body);
        });
        this.addEventToKnownMap(Client.events.fileSocket, function (socket, event) {
            console.log("received a fileSocket: " + event.body.toString());
            _this.consumeFileFromNewSocket(event.body.file, event.body.address);
        });
    };
    Client.prototype.addEventToKnownMap = function (key, listener) {
        this.eventActionMap[key] = listener;
    };
    Client.events = {
        error: 'error',
        changed: 'changed',
        fileSocket: 'fileSocket',
        getFile: 'getFile'
    };
    return Client;
}());
module.exports = Client;
//# sourceMappingURL=client.js.map