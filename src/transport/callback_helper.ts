import {Messenger} from "../connection/messenger";
import {Event, EventsHelper} from "../client/events_helper";
import {debugFor} from "../utils/logger";

const debug = debugFor('syncrow:callback_helper');

//TODO add timeout ability
//TODO add clear ability - delete all callbacks that are awaiting from otherParty that disconnected
export class CallbackHelper {
    private callbackMap:Map<string,(err:Error, event:Event)=>any>;

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
     * @param event
     * @returns {boolean}
     */
    public checkResponse(event:Event):boolean {

        if (event.id && this.callbackMap.has(event.id)) {
            debug(`found callback for stored id`);
            const callback = this.callbackMap.get(event.id);
            this.callbackMap.delete(event.id);
            callback(null, event);
            return true;
        }

        return false;
    }

    private static generateEventId():number {
        return Math.random();
    }
}
