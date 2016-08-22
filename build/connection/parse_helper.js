var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var events_1 = require("events");
var logger_1 = require("../utils/logger");
var debug = logger_1.debugFor('syncrow:connection:parse_helper');
var ParseHelper = (function (_super) {
    __extends(ParseHelper, _super);
    /**
     * Enables sending string messages between parties
     */
    function ParseHelper(socket) {
        var _this = this;
        _super.call(this);
        this.socket = socket;
        this.listener = function (data) { return _this.parseData(data); };
        this.resetBuffers();
        this.socket.on('data', this.listener);
    }
    /**
     * @param data
     * @returns {string}
     */
    ParseHelper.prototype.writeMessage = function (data) {
        debug("writing message: " + data);
        this.socket.write("" + data.length + ParseHelper.separator + data);
    };
    /**
     * Removes own listener from socket
     */
    ParseHelper.prototype.shutdown = function () {
        debug("removing listeners");
        this.socket.removeListener('data', this.listener);
    };
    ParseHelper.prototype.parseData = function (data) {
        this.messageBuffer += data.toString();
        if (this.expectedLength === null) {
            this.checkIfExpectedLengthArrived();
        }
        this.checkIfMessageIsComplete();
    };
    ParseHelper.prototype.resetBuffers = function () {
        this.messageBuffer = '';
        this.expectedLength = null;
    };
    ParseHelper.prototype.checkIfExpectedLengthArrived = function () {
        var indexOfContentLengthHeaderSeparator = this.messageBuffer.indexOf(ParseHelper.separator);
        if (indexOfContentLengthHeaderSeparator !== -1) {
            this.expectedLength = parseInt(this.messageBuffer.slice(0, indexOfContentLengthHeaderSeparator));
            this.messageBuffer = this.messageBuffer.slice(indexOfContentLengthHeaderSeparator + 1);
        }
    };
    ParseHelper.prototype.checkIfMessageIsComplete = function () {
        if (this.expectedLength && this.messageBuffer.length >= this.expectedLength) {
            var message = this.messageBuffer.slice(0, this.expectedLength);
            debug("got message: " + message);
            this.emit(ParseHelper.events.message, message);
            this.restartParsingMessage(this.messageBuffer.slice(this.expectedLength));
        }
    };
    ParseHelper.prototype.restartParsingMessage = function (remainder) {
        this.resetBuffers();
        this.messageBuffer = remainder;
        this.checkIfExpectedLengthArrived();
        this.checkIfMessageIsComplete();
    };
    ParseHelper.separator = ':';
    ParseHelper.events = {
        message: 'message',
    };
    return ParseHelper;
})(events_1.EventEmitter);
exports.ParseHelper = ParseHelper;
//# sourceMappingURL=parse_helper.js.map