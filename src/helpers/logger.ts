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

    timeDebug(message:string) {
        console.time(this.getFormattedMessageInColor('blue', message));
    }

    timeEndDebug(message:string) {
        console.timeEnd(this.getFormattedMessageInColor('blue', message));
    }
    
    time(message:string) {
        console.time(this.getFormattedMessageInColor('blue', message));
    }

    timeEnd(message:string) {
        console.timeEnd(this.getFormattedMessageInColor('blue', message));
    }

    private logInColor(message:string, color:string) {
        console.log(this.getFormattedMessageInColor(color, message));
    }

    private getFormattedMessageInColor(color:string, message:string) {
        return chalk[color](this.formatMessage(message));
    }

    private formatMessage(message:string) {
        return `${this.context} ${message}`;
    }

    public static getNewLogger(context:string):Logger {
        return new Logger(context);
    }
}


export = Logger;
