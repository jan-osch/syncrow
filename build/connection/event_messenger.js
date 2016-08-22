var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var logger_1 = require("../utils/logger");
var parse_helper_1 = require("./parse_helper");
var events_1 = require("events");
var debug = logger_1.debugFor('syncrow:evented_messenger');
var logger = logger_1.loggerFor('Messenger');
var EventMessenger = (function (_super) {
    __extends(EventMessenger, _super);
    /**
     * Enables sending string messages between parties
     * @param socket
     */
    function EventMessenger(socket) {
        var _this = this;
        _super.call(this);
        this.socket = socket;
        this.socket.on('error', function (error) { return _this.disconnectAndDestroyCurrentSocket(error); });
        this.socket.on('close', function (error) { return _this.disconnectAndDestroyCurrentSocket(error); });
        this.parseHelper = new parse_helper_1.ParseHelper(this.socket);
        this.parseHelper.on(parse_helper_1.ParseHelper.events.message, function (message) { return _this.parseAndEmit(message); });
        this.isAlive = true;
    }
    /**
     * @returns {boolean}
     */
    EventMessenger.prototype.isMessengerAlive = function () {
        return this.isAlive;
    };
    /**
     * Removes all helpers to prevent memory leaks
     */
    EventMessenger.prototype.shutdown = function () {
        delete this.parseHelper;
        this.disconnectAndDestroyCurrentSocket();
    };
    /**
     * Convenience method
     * @param type
     * @param body
     */
    EventMessenger.prototype.send = function (type, body) {
        if (!this.isAlive) {
            throw new Error('Socket connection is closed will not write data');
        }
        var message = JSON.stringify({
            type: type,
            body: body,
        });
        this.parseHelper.writeMessage(message);
    };
    EventMessenger.prototype.disconnectAndDestroyCurrentSocket = function (error) {
        if (error)
            logger.error("Socket error: " + error);
        if (this.socket) {
            var socket = this.socket;
            delete this.socket;
            this.isAlive = false;
            socket.removeAllListeners();
            socket.destroy();
            this.emit(EventMessenger.events.died);
        }
    };
    EventMessenger.prototype.parseEvent = function (message) {
        try {
            return JSON.parse(message.toString());
        }
        catch (e) {
            debug("Sending error: exception during parsing message: " + message);
            this.send(EventMessenger.events.error, { title: 'Bad event', details: message });
        }
    };
    EventMessenger.prototype.parseAndEmit = function (rawMessage) {
        var event = this.parseEvent(rawMessage);
        if (this.listenerCount(event.type) == 0) {
            return this.emit(EventMessenger.events.error, { title: "Unknown event type: " + event.type, details: event });
        }
        debug("emitting event: " + event.type);
        return this.emit(event.type, event);
    };
    EventMessenger.events = {
        message: 'message',
        died: 'disconnected',
        error: 'error'
    };
    return EventMessenger;
})(events_1.EventEmitter);
exports.EventMessenger = EventMessenger;
//# sourceMappingURL=event_messenger.js.map