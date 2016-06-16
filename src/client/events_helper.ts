/// <reference path="../../typings/main.d.ts" />
import {Messenger} from "../connection/messenger";
import {debugFor} from "../utils/logger";
import {Event, eventTypes, Pull, Offer} from "./events";

const debug = debugFor('syncrow:events');

//TODO change this class to Event - allow static creation
export class EventsHelper {

    static events = {
        error: 'error'
    };

    /**
     * @param type
     * @param body
     * @returns {string}
     */
    public static createEvent(type:string, body = {}):string {
        return JSON.stringify({
            type: type,
            body: body,
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
     */
    public static sendEvent(otherParty:Messenger, type:string, message?:any) {
        const event = EventsHelper.createEvent(type, message);
        debug(`writing event: ${event}`);
        otherParty.writeMessage(event);
    }
}