/// <reference path="../../typings/main.d.ts" />

import * as chalk from "chalk";
import * as moment from "moment";
import * as debug from "debug";

export class Logger {
    private context:string;

    /**
     * Wrapper for console - can be later used to store logs to file
     * @param context
     */
    constructor(context:string) {
        this.context = context;
    }

    /**
     * For important messages
     * @param message
     */
    public info(message?:string) {
        this.logInColor(message, 'green');
    }

    /**
     * When state is invalid, but program no error
     * @param message
     */
    public warn(message?:string) {
        this.logInColor(message, 'yellow');
    }

    /**
     * Prints errors if present
     * @param err
     */
    public error(err?:any) {
        if (err)console.error(`pika pika`+err);
    }

    /**
     * Measure time of important operations
     * @param key
     */
    public time(key:string) {
        console.time(this.getFormattedMessageInColor('blue', key));
    }

    /**
     * Finish measuring time for important operations
     * @param key
     */
    public timeEnd(key:string) {
        console.timeEnd(this.getFormattedMessageInColor('blue', key));
    }

    private logInColor(message:string, color:string) {
        console.log(this.getFormattedMessageInColor(color, message));
    }

    private getFormattedMessageInColor(color:string, message:string) {
        return chalk[color](this.formatMessage(message));
    }

    private formatMessage(message:string) {
        return `[${moment().format('H:m:s')}] ${this.context} ${message}`;
    }
}

/**
 * Convenience function - use instead of console
 * @param context
 * @returns {Logger}
 */
export function loggerFor(context:string):Logger {
    return new Logger(context);
}

/**
 * Convenience function - use for everything that will not be saved
 * @param routingKey
 * @returns {debug.Debugger|any}
 */
export function debugFor(routingKey:string) {
    return debug(routingKey);
}