/// <reference path="../typings/main.d.ts" />

import chalk = require('chalk');

class Logger{
    static number = 0;
}

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
