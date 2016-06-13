/// <reference path="../../typings/main.d.ts" />
import {Messenger} from "../connection/messenger";
import {debugFor} from "../utils/logger";
import {Event} from "./events";

const debug = debugFor('syncrow:events');

//TODO change this class to Event - allow static creation
export class EventsHelper {

    static events = {
        error: 'error'
    };

    /**
     * @param type
     * @param body
     * @param id
     * @returns {string}
     */
    public static createEvent(type:string, body = {}, id?:number):string {
        return JSON.stringify({
            type: type,
            body: body,
            id: id
        });
    }

    /**
     * Parses event and if error occurs, notifies the other party
     * @param otherParty
     * @param message
     * @returns {any}
     */
    public static parseEvent(otherParty:Messenger, message:string):Event {
        try {
            return JSON.parse(message.toString());
        } catch (e) {
            EventsHelper.sendEvent(otherParty, EventsHelper.events.error, 'bad event');
        }
    }

    /**
     * @param otherParty
     * @param type
     * @param message
     * @param id
     */
    public static sendEvent(otherParty:Messenger, type:string, message?:any, id?:number) {
        const event = EventsHelper.createEvent(type, message, id);
        debug(`writing event: ${event}`);
        otherParty.writeMessage(event);
    }

    /**
     * New method for better sending
     * @param otherParty
     * @param event
     */
    public static sendEventTwo(otherParty:Messenger, event:Object) {
        debug(`writing event: ${event}`);
        otherParty.writeMessage(JSON.stringify(event));
    }
}