import * as chalk from "chalk";
import * as debug from "debug";

export class Logger {
    private context:string;
    private timers:Map<string,Date>;
    private keys:Map<string,string>;

    /**
     * Wrapper for console - can be later used to store logs to file
     * @param context
     */
    constructor(context:string) {
        this.context = context;
        this.timers = new Map<string,Date>();
        this.keys = new Map<string,string>();
    }

    /**
     * Returns an id to use later
     * @param key
     * @returns {string}
     */
    public time(key:string) {
        const id = Logger.generateId();

        this.keys.set(id, key);
        this.timers.set(id, new Date());

        return id;
    }

    /**
     * @param id - must be id returned by time
     */
    public timeEnd(id:string) {
        const time = this.timers.get(id);
        const key = this.keys.get(id);

        if (!this.timers.delete(id) || !this.keys.delete(id)) {
            return this.error('Id does not exist');
        }

        this.logInColor(`${key} - ${new Date().getTime() - time.getTime()} ms`, 'green');
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
        if (err) this.logInColor(`ERROR: ${err.stack ? err.stack : err}`, 'red');
    }

    private static generateId() {
        return Math.random().toString();
    }

    private logInColor(message:string, color:string) {
        console.log(this.getFormattedMessageInColor(color, message));
    }

    private getFormattedMessageInColor(color:string, message:string) {
        return chalk[color](this.formatMessage(message));
    }

    private formatMessage(message:string) {
        return `[unix: ${new Date().getTime()}] ${this.context} - ${message}`;
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