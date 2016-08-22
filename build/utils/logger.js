/// <reference path="../../typings/index.d.ts" />
var chalk = require("chalk");
var moment = require("moment");
var debug = require("debug");
//TODO implement logger to file system
var Logger = (function () {
    /**
     * Wrapper for console - can be later used to store logs to file
     * @param context
     */
    function Logger(context) {
        this.context = context;
    }
    /**
     * For important messages
     * @param message
     */
    Logger.prototype.info = function (message) {
        this.logInColor(message, 'green');
    };
    /**
     * When state is invalid, but finalConfig no error
     * @param message
     */
    Logger.prototype.warn = function (message) {
        this.logInColor(message, 'yellow');
    };
    /**
     * Prints errors if present
     * @param err
     */
    Logger.prototype.error = function (err) {
        if (err)
            this.logInColor("ERROR:" + err, 'red');
    };
    /**
     * Measure time of important operations
     * @param key
     */
    Logger.prototype.time = function (key) {
        console.time(this.getFormattedMessageInColor('blue', key));
    };
    /**
     * Finish measuring time for important operations
     * @param key
     */
    Logger.prototype.timeEnd = function (key) {
        console.timeEnd(this.getFormattedMessageInColor('blue', key));
    };
    Logger.prototype.logInColor = function (message, color) {
        console.log(this.getFormattedMessageInColor(color, message));
    };
    Logger.prototype.getFormattedMessageInColor = function (color, message) {
        return chalk[color](this.formatMessage(message));
    };
    Logger.prototype.formatMessage = function (message) {
        return "[" + moment().format('H:m:s') + "] " + this.context + " " + message;
    };
    return Logger;
})();
exports.Logger = Logger;
/**
 * Convenience function - use instead of console
 * @param context
 * @returns {Logger}
 */
function loggerFor(context) {
    return new Logger(context);
}
exports.loggerFor = loggerFor;
/**
 * Convenience function - use for everything that will not be saved
 * @param routingKey
 * @returns {debug.Debugger|any}
 */
function debugFor(routingKey) {
    return debug(routingKey);
}
exports.debugFor = debugFor;
//# sourceMappingURL=logger.js.map