import {debugFor, loggerFor} from "../utils/logger";
import {Socket} from "net";
import {EventEmitter} from "events";
import {ParseHelper} from "./parse_helper";
import {Closable} from "../utils/interfaces";

const debug = debugFor('syncrow:evented_messenger');
const logger = loggerFor('Messenger');

export interface Event {
    type:string,
    body?:any
}


export class EventMessenger extends EventEmitter implements Closable {

    private socket:Socket;
    private isAlive:boolean;
    private parseHelper:ParseHelper;

    static events = {
        message: 'message',
        died: 'disconnected',
    };

    static error:'error';

    /**
     * Enables sending string messages between parties
     * @param socket
     */
    constructor(socket:Socket) {
        super();
        this.socket = socket;
        this.socket.on('error', (error)=>this.disconnectAndDestroyCurrentSocket(error));
        this.socket.on('close', (error)=>this.disconnectAndDestroyCurrentSocket(error));

        this.parseHelper = new ParseHelper(this.socket);
        this.parseHelper.on(ParseHelper.events.message, (message)=>this.parseAndEmit(message));

        this.isAlive = true;
    }

    /**
     * @returns {boolean}
     */
    public isMessengerAlive() {
        return this.isAlive;
    }

    /**
     * Removes all helpers to prevent memory leaks
     */
    public shutdown() {
        delete this.parseHelper;
        this.disconnectAndDestroyCurrentSocket();
    }

    /**
     * Convenience method
     * @param type
     * @param body
     */
    public send(type:string, body?:any) {
        if (!this.isAlive) {
            throw new Error('Socket connection is closed will not write data')
        }

        const message = JSON.stringify({
            type: type,
            body: body,
        });

        this.parseHelper.writeMessage(message);
    }


    private disconnectAndDestroyCurrentSocket(error?:Error) {
        if (error)logger.error(`Socket error: ${error}`);

        this.isAlive = false;
        this.socket.removeAllListeners();
        this.socket.destroy();
        this.emit(EventMessenger.events.died);
        delete this.socket;
    }

    private parseEvent(message:string):Event {
        try {
            return JSON.parse(message.toString());
        } catch (e) {
            debug(`Sending error: exception during parsing message: ${message}`);
            this.send(EventMessenger.error, {title: 'Bad event', details: message});
        }
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