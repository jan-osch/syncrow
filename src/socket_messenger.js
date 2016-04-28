/// <reference path="../typings/main.d.ts" />
"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var net = require('net');
var events = require('events');
var logger = require('./logger');
//TODO add support for disconnection
var SocketMessenger = (function (_super) {
    __extends(SocketMessenger, _super);
    function SocketMessenger(host, port, socket) {
        _super.call(this);
        this.separator = ':';
        this.resetBuffers();
        if (socket) {
            this.socket = socket;
            this.addListenersToSocket(this.socket);
        }
        else {
            this.socket = null;
            this.connect(host, port);
        }
    }
    SocketMessenger.prototype.writeData = function (data) {
        var message = "" + data.length + this.separator + data;
        this.socket.write(message);
    };
    SocketMessenger.prototype.resetBuffers = function () {
        this.messageBuffer = '';
        this.expectedLength = null;
    };
    SocketMessenger.prototype.addListenersToSocket = function (socket) {
        var _this = this;
        socket.on('data', function (data) { return _this.parseData(data); });
        socket.on('close', function () {
            logger.info('socket connection disconnected');
            _this.emit(SocketMessenger.events.disconnected);
        });
        this.emit(SocketMessenger.events.connected);
    };
    SocketMessenger.prototype.connect = function (host, port) {
        var _this = this;
        this.socket = net.connect(port, host, function () {
            logger.info("connected with " + host + ":" + port);
            _this.addListenersToSocket(_this.socket);
        });
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
            this.emit(SocketMessenger.messageEvent, this.messageBuffer.slice(0, this.expectedLength));
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
    SocketMessenger.messageEvent = 'message';
    return SocketMessenger;
}(events.EventEmitter));
module.exports = SocketMessenger;
//# sourceMappingURL=socket_messenger.js.map