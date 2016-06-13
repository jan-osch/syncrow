import {Messenger} from "../connection/messenger";
import {Event, EventsHelper} from "../client/events_helper";
import {debugFor, loggerFor} from "../utils/logger";

const debug = debugFor('syncrow:callback_helper');

//TODO add timeout ability
//TODO add clear ability - delete all callbacks that are awaiting from otherParty that disconnected
export class CallbackHelper {
    private callbackMap:Map<string,Function>;

    /**
     * Used to exchange events with callbacks
     */
    constructor() {
        this.callbackMap = new Map();
    }

    /**
     * Generates eventId
     * @param otherParty
     * @param type
     * @param body
     * @param callback
     */
    public sendWrapped(otherParty:Messenger, type:string, body:any, callback:(err:Error, event:Event)=>any) {
        const eventId = CallbackHelper.generateEventId();
        this.callbackMap.set(eventId, callback);

        EventsHelper.sendEvent(otherParty, type, body, eventId);
    }

    /**
     * Returns callback if it exists
     * @param id
     * @returns {function(Error, Event): any}
     */
    public retriveCallback(id:string):Function {
        if (id && this.callbackMap.has(id)) {
            debug(`found callback for stored id`);
            const callback = this.callbackMap.get(id);
            this.callbackMap.delete(id);
            return callback;
        }
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
}
