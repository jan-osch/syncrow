/// <reference path="../typings/main.d.ts" />
"use strict";
var chalk = require('chalk');
var Logger = (function () {
    function Logger() {
    }
    Logger.number = 0;
    return Logger;
}());
function debug(content) {
    console.log(chalk.grey(content));
}
function info(content) {
    console.log(chalk.green(content));
}
module.exports = {
    debug: debug,
    info: info
};
//# sourceMappingURL=logger.js.map