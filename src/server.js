/// <reference path="../typescript-interfaces/node.d.ts" />
"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var net = require('net');
var SocketMessenger = require('./socket_messenger');
var Client = require('./client');
var Server = (function (_super) {
    __extends(Server, _super);
    function Server(directoryToWatch, mainPort) {
        _super.call(this, directoryToWatch);
        this.clients = [];
        this.socketServer = this.createSocketServer(mainPort);
    }
    Server.prototype.emitFileChanged = function (fileName) {
        var _this = this;
        this.clients.forEach(function (socket) {
            _this.writeEventToSocketMessenger(socket, Client.events.changed, fileName);
        });
    };
    Server.prototype.addNewClient = function (socket) {
        var _this = this;
        console.info('new client connected');
        var clientSocketMessenger = new SocketMessenger(null, null, socket);
        this.clients.push(clientSocketMessenger);
        clientSocketMessenger.on(SocketMessenger.messageEvent, function (data) { return _this.routeEvent(clientSocketMessenger, data); });
    };
    Server.prototype.createSocketServer = function (mainPort) {
        var _this = this;
        return net.createServer(function (socket) { return _this.addNewClient(socket); }).listen(mainPort, function () {
            console.log("started listening on port " + mainPort);
        });
    };
    return Server;
}(Client));
module.exports = Server;
//# sourceMappingURL=server.js.map