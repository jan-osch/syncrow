/// <reference path="../typescript-interfaces/node.d.ts" />
"use strict";
var chalk = require('chalk');
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
//# sourceMappingURL=utils.js.map