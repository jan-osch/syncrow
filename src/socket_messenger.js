/// <reference path="../typings/main.d.ts" />
"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var events = require('events');
var Logger = require('./helpers/logger');
var ConnectionHelper = require("./helpers/connection_helper");
var logger = Logger.getNewLogger('SocketMessenger');
var SocketMessenger = (function (_super) {
    __extends(SocketMessenger, _super);
    function SocketMessenger(connectionHelper) {
        _super.call(this);
        this.separator = ':';
        this.resetBuffers();
        this.connected = false;
        this.socket = null;
        this.connectionHelper = connectionHelper;
        this.obtainNewSocket();
    }
    SocketMessenger.prototype.obtainNewSocket = function () {
        var _this = this;
        this.connectionHelper.once(ConnectionHelper.events.socket, function (socket) {
            logger.debug('/obtainNewSocket- adding new socket');
            _this.socket = socket;
            _this.connected = true;
            _this.addListenersToSocket(_this.socket);
        });
        logger.debug('/obtainNewSocket- requesting new socket');
        this.connectionHelper.getSocket();
    };
    SocketMessenger.prototype.writeData = function (data) {
        if (!this.connected) {
            return logger.warn('/writeData - socket connection is closed will not write data');
        }
        var message = "" + data.length + this.separator + data;
        this.socket.write(message);
    };
    SocketMessenger.prototype.resetBuffers = function () {
        this.messageBuffer = '';
        this.expectedLength = null;
    };
    SocketMessenger.prototype.addListenersToSocket = function (socket) {
        var _this = this;
        logger.debug('/addListenersToSocket - adding listeners to new socket');
        socket.on('data', function (data) { return _this.parseData(data); });
        socket.on('close', function () { return _this.handleSocketDisconnected(); });
        this.emit(SocketMessenger.events.connected);
    };
    SocketMessenger.prototype.handleSocketDisconnected = function () {
        logger.debug('socket connection closed');
        this.connected = false;
        this.obtainNewSocket();
        this.emit(SocketMessenger.events.disconnected);
    };
    SocketMessenger.prototype.parseData = function (data) {
        this.messageBuffer += data.toString();
        if (this.expectedLength === null) {
            this.checkIfExpectedLengthArrived();
        }
        this.checkIfMessageIsComplete();
    };
    SocketMessenger.prototype.checkIfExpectedLengthArrived = function () {
        var indexOfContentLengthHeaderSeparator = this.messageBuffer.indexOf(this.separator);
        if (indexOfContentLengthHeaderSeparator !== -1) {
            this.expectedLength = parseInt(this.messageBuffer.slice(0, indexOfContentLengthHeaderSeparator));
            this.messageBuffer = this.messageBuffer.slice(indexOfContentLengthHeaderSeparator + 1);
        }
    };
    SocketMessenger.prototype.checkIfMessageIsComplete = function () {
        if (this.expectedLength && this.messageBuffer.length >= this.expectedLength) {
            this.emit(SocketMessenger.events.message, this.messageBuffer.slice(0, this.expectedLength));
            this.restartParsingMessage(this.messageBuffer.slice(this.expectedLength));
        }
    };
    SocketMessenger.prototype.restartParsingMessage = function (remainder) {
        this.resetBuffers();
        this.messageBuffer = remainder;
        this.checkIfExpectedLengthArrived();
        this.checkIfMessageIsComplete();
    };
    SocketMessenger.prototype.getOwnHost = function () {
        return this.socket.address().address;
    };
    SocketMessenger.events = {
        message: 'message',
        connected: 'connected',
        disconnected: 'disconnected'
    };
    return SocketMessenger;
}(events.EventEmitter));
module.exports = SocketMessenger;
//# sourceMappingURL=socket_messenger.js.map