/// <reference path="../../typings/main.d.ts" />
import {Messenger} from "../transport/messenger";
import {debugFor} from "../utils/logger";

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
            body: body
        });
    }

    /**
     * Parses event and if error occurs, notifies the other party
     * @param otherParty
     * @param message
     * @returns {any}
     */
    public static parseEvent(otherParty:Messenger, message:string):{type:string, body?:any} {
        try {
            return JSON.parse(message.toString());
        } catch (e) {
            EventsHelper.writeEventToOtherParty(otherParty, EventsHelper.events.error, 'bad event');
        }
    }

    /**
     * @param otherParty
     * @param type
     * @param message
     */
    public static writeEventToOtherParty(otherParty:Messenger, type:string, message?:any) {
        debug(`writing event: ${type} message: ${message}`);
        otherParty.writeMessage(EventsHelper.createEvent(type, message));
    }
}