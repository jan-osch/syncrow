/// <reference path="../../typings/main.d.ts" />

import Messenger = require("../messenger");

export default class EventsHelper {

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
        otherParty.writeMessage(EventsHelper.createEvent(type, message));
    }
}