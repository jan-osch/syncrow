/// <reference path="../../typings/main.d.ts" />

import * as chalk from "chalk";
import * as moment from "moment";

export class Logger {
    private context:string;

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
        if (err)console.error(err);
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
 * Convenience function
 * @param context
 * @returns {Logger}
 */
export function loggerFor(context:string):Logger {
    return new Logger(context);
}