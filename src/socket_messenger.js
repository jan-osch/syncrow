"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
/// <reference path="../typescript-interfaces/node.d.ts" />
var net = require('net');
var events = require('events');
var SocketMessenger = (function (_super) {
    __extends(SocketMessenger, _super);
    function SocketMessenger(host, port, socket) {
        var _this = this;
        _super.call(this);
        this.separator = ':';
        this.resetBuffers();
        if (socket) {
            this.socket = socket;
            this.socket.on('data', function (data) { return _this.parseData(data); });
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
    SocketMessenger.prototype.connect = function (host, port) {
        var _this = this;
        this.socket = net.connect(port, host, function () {
            console.log("connected with " + host + ":" + port);
            _this.socket.on('data', function (data) { return _this.parseData(data); });
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
    SocketMessenger.messageEvent = 'message';
    return SocketMessenger;
}(events.EventEmitter));
module.exports = SocketMessenger;
//# sourceMappingURL=socket_messenger.js.map