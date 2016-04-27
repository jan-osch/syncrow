/// <reference path="../typescript-interfaces/node.d.ts" />

import chalk = require('chalk');

function debug(content:string) {
    console.log(chalk.grey(content));
}
function info(content:string) {
    console.log(chalk.green(content));
}

export ={
    debug: debug,
    info: info
}
