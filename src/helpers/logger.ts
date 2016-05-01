/// <reference path="../../typings/main.d.ts" />

import chalk = require('chalk');

//TODO add support for local verbose level
//TODO add support for global verbose level

class Logger {
    static level = 0;
    private context:string;

    constructor(context:string) {
        this.context = context;
    }

    debug(message:string) {
        this.logInColor(message, 'grey')
    }

    info(message:string) {
        this.logInColor(message, 'green');
    }

    warn(message:string) {
        this.logInColor(message, 'yellow');
    }

    private logInColor(message:string, color:string) {
        console.log(chalk[color](this.formatMessage(message)));
    }

    private formatMessage(message:string) {
        return `${this.context} ${message}`;
    }

    public static getNewLogger(context:string):Logger {
        return new Logger(context);
    }
}


export = Logger;
