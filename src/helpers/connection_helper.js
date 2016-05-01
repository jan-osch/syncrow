/// <reference path="../../typings/main.d.ts" />
"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var Logger = require('./logger');
var net = require('net');
var events_1 = require("events");
var logger = Logger.getNewLogger('ConnectionHelper');
var ConnectionHelper = (function (_super) {
    __extends(ConnectionHelper, _super);
    function ConnectionHelper(port, host, server) {
        _super.call(this);
        this.host = host;
        this.port = port;
        this.isServer = server;
    }
    ConnectionHelper.prototype.getSocket = function () {
        if (this.isServer && !this.server) {
            return this.initializeServer();
        }
        else if (this.isServer) {
            return logger.debug('/getSocket - server already initialized - waiting for socket to connect');
        }
        return this.getNewSocketAsClient();
    };
    ConnectionHelper.prototype.initializeServer = function () {
        var _this = this;
        this.server = net.createServer(function (socket) { return _this.handleNewSocketAsServer(socket); })
            .listen({ port: this.port }, function () {
            logger.debug("/getNewSocketAsServer - server listening on port " + _this.port);
        });
    };
    ConnectionHelper.prototype.handleNewSocketAsServer = function (socket) {
        logger.debug('/handleNewSocketAsServer - new socket connected');
        this.emit(ConnectionHelper.events.socket, socket);
    };
    ConnectionHelper.prototype.getNewSocketAsClient = function () {
        var _this = this;
        var socket = net.connect(this.port, this.host, function () {
            logger.info("/getNewSocketAsClient - connected with " + _this.host + ":" + _this.port);
            _this.emit(ConnectionHelper.events.socket, socket);
        });
    };
    ConnectionHelper.events = {
        socket: 'socket'
    };
    return ConnectionHelper;
}(events_1.EventEmitter));
module.exports = ConnectionHelper;
//# sourceMappingURL=connection_helper.js.map