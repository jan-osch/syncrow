import {debugFor} from "../utils/logger";

const debug = debugFor('syncrow:transport:callback_helper');

export class CallbackHelper {
    private callbackMap:Map<string,Function>;

    /**
     * Used to exchange commands with callbacks
     */
    constructor() {
        this.callbackMap = new Map();
    }

    /**
     * Returns callback if it exists
     * @param id
     * @returns {function(Error, Event): any}
     */
    public getCallback(id:string):Function {
        if (id && this.callbackMap.has(id)) {
            debug(`found callback for stored id: ${id}`);
            const callback = this.callbackMap.get(id);
            this.callbackMap.delete(id);
            return callback;
        }
        debug(`callback not found for id: ${id}`);
    }

    /**
     * Generates an Id
     * @returns {string}
     */
    public static generateEventId():string {
        return Math.random().toString();
    }

    /**
     * Adds a function to map of remembered callbacks
     * @throws Error if id already exists
     * @param id
     * @param callback
     */
    public addCallbackWithId(id:string, callback:Function) {
        if (this.callbackMap.has(id)) {
            throw new Error(`callback id: ${id} already exists`);
        }

        debug(`setting a callback for id: ${id}`);
        this.callbackMap.set(id, callback);
    }

    /**
     * Handy function that generates id stores the callback and returns id
     * @param callback
     * @returns {string} id
     */
    public addCallback(callback:Function):string {
        const id = CallbackHelper.generateEventId();
        this.addCallbackWithId(id, callback);
        return id;
    }

    /**
     * If something fails
     * @param id
     */
    public deleteMapping(id) {
        if (this.callbackMap.delete(id)) {
            return;
        }
        throw new Error(`callback id: ${id} did not exist`);
    }
}
