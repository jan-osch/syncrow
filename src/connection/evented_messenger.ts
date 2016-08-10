import {Messenger, MessengerParams} from "./messenger";
import {debugFor} from "../utils/logger";
import {ConnectionAddress, ConnectionHelper} from "./connection_helper";
import {Socket} from "net";

const debug = debugFor('syncrow:evented_messenger');

export interface Event {
    type:string,
    body?:any
}

export class EventMessenger extends Messenger {

    static error = 'error';

    constructor(params:MessengerParams, socket:Socket, connectionHelper:ConnectionHelper) {
        super(params, socket, connectionHelper);
        this.on(Messenger.events.message, (rawMessage)=>this.parseAndEmit(rawMessage));
    }

    /**
     * Parses event and if error occurs, notifies the other party
     * @param message
     * @returns {Event}
     */
    private parseEvent(message:string):Event {
        try {
            return JSON.parse(message.toString());
        } catch (e) {
            debug(`Sending error: exception during parsing message: ${message}`);
            this.send(EventMessenger.error, {title: 'Bad event', details: message});
        }
    }

    /**
     * Convenience method
     * @param type
     * @param body
     */
    public send(type:string, body?:any) {
        const message = JSON.stringify({
            type: type,
            body: body,
        });

        super.writeMessage(message);
    }

    private parseAndEmit(rawMessage:string) {
        const event = this.parseEvent(rawMessage);

        if (this.listenerCount(event.type) == 0) {
            return this.emit(EventMessenger.error, {title: `Unknown event type: ${event.type}`, details: event})
        }

        debug(`emitting event: ${event.type}`);
        return this.emit(event.type, event);
    }
}