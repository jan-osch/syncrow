/// <reference path="../../typings/main.d.ts" />
"use strict";
var chalk = require('chalk');
var Logger = (function () {
    function Logger(context) {
        this.context = context;
    }
    Logger.prototype.debug = function (message) {
        this.logInColor(message, 'grey');
    };
    Logger.prototype.info = function (message) {
        this.logInColor(message, 'green');
    };
    Logger.prototype.warn = function (message) {
        this.logInColor(message, 'yellow');
    };
    Logger.prototype.logInColor = function (message, color) {
        console.log(chalk[color](this.formatMessage(message)));
    };
    Logger.prototype.formatMessage = function (message) {
        return this.context + " " + message;
    };
    Logger.getNewLogger = function (context) {
        return new Logger(context);
    };
    Logger.level = 0;
    return Logger;
}());
module.exports = Logger;
//# sourceMappingURL=logger.js.map