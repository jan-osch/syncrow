/// <reference path="../../typings/main.d.ts" />

import chalk = require('chalk');
import Configuration = require('../configuration');

//TODO refactor
class Logger {
    private localLevel:number;
    private context:string;

    constructor(context:string, localLevel = 10) {
        this.context = context;
        this.localLevel = localLevel;
    }

    debug(message:string) {
        if (this.levelHigherThan(3))
            this.logInColor(message, 'grey')
    }

    info(message:string) {
        if (this.levelHigherThan(0))
            this.logInColor(message, 'green');
    }

    warn(message:string) {
        if (this.levelHigherThan(0))
            this.logInColor(message, 'yellow');
    }

    timeDebug(message:string) {
        if (this.levelHigherThan(2))
            console.time(this.getFormattedMessageInColor('blue', message));
    }

    timeEndDebug(message:string) {
        if (this.levelHigherThan(2))
            console.timeEnd(this.getFormattedMessageInColor('blue', message));
    }

    time(message:string) {
        if (this.levelHigherThan(1))
            console.time(this.getFormattedMessageInColor('blue', message));
    }

    timeEnd(message:string) {
        if (this.levelHigherThan(1))
            console.timeEnd(this.getFormattedMessageInColor('blue', message));
    }

    private logInColor(message:string, color:string) {
        console.log(this.getFormattedMessageInColor(color, message));
    }

    private getFormattedMessageInColor(color:string, message:string) {
        return chalk[color](this.formatMessage(message));
    }

    private formatMessage(message:string) {
        return `[${new Date()}] ${this.context} ${message}`;
    }

    public static getNewLogger(context:string, level?:number):Logger {
        return new Logger(context, level);
    }

    private levelHigherThan(level:number) {
        return this.localLevel >= level;
    }
}


export = Logger;
