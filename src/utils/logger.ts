import * as chalk from "chalk";
import * as debug from "debug";

//TODO implement logger to file system
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
     * For important commands
     * @param message
     */
    public info(message?:string) {
        this.logInColor(message, 'green');
    }

    /**
     * When state is invalid, but finalConfig no error
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
        if (err) this.logInColor(`ERROR:` + err, 'red');
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


export interface ErrorCallback {
    (err:Error):any
}