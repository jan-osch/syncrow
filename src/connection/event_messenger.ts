import {debugFor, loggerFor} from "../utils/logger";
import {Socket} from "net";
import {ParseHelper} from "./parse_helper";
import {Closable} from "../utils/interfaces";
import {EventEmitter} from "events";
import {CallbackHelper} from "./callback_helper";

const debug = debugFor('syncrow:evented_messenger');
const logger = loggerFor('Messenger');

export interface Event {
    type:string;
    body?:any;
    id?:string;
}


export class EventMessenger extends EventEmitter implements Closable {

    private socket:Socket;
    private isAlive:boolean;
    private parseHelper:ParseHelper;
    private callbackHelper:CallbackHelper;

    static response:'eventMessengerResponse';

    static events = {
        message: 'message',
        died: 'disconnected',
        error: 'error'
    };

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

        this.callbackHelper = new CallbackHelper();

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
     * @param id
     */
    public send(type:string, body?:any, id?:string) {
        if (!this.isAlive) {
            throw new Error('Socket connection is closed will not write data')
        }

        const event:Event = {
            type: type,
            body: body,
        };

        if (id) event.id = id;

        this.parseHelper.writeMessage(JSON.stringify(event));
    }

    /**
     * @param type
     * @param body
     * @param callback
     */
    public sendRequest(type:string, body:any, callback:Function) {
        const id = this.callbackHelper.addCallback(callback);

        this.send(type, body, id);
    }

    /**
     * @param source
     * @param payload
     */
    public sendResponse(source:Event, payload:any) {
        this.send(EventMessenger.response, payload, source.id);
    }


    private disconnectAndDestroyCurrentSocket(error?:Error) {
        if (error)logger.error(`Socket error: ${error}`);

        if (this.socket) {
            const socket = this.socket;
            delete this.socket;
            this.isAlive = false;
            socket.removeAllListeners();
            socket.destroy();
            this.emit(EventMessenger.events.died);
        }
    }

    private parseEvent(message:string):Event {
        try {
            return JSON.parse(message.toString());
        } catch (e) {
            debug(`Sending error: exception during parsing message: ${message}`);
            this.send(EventMessenger.events.error, {title: 'Bad event', details: message});
        }
    }

    private parseAndEmit(rawMessage:string) {
        const event = this.parseEvent(rawMessage);

        if (event.type === EventMessenger.response) {
            try {
                return this.callbackHelper.getCallback(event.id)(null, event.body);
            } catch (err) {
                return this.emit(EventMessenger.events.error, {title: `unknown id: ${event.id}`, details: err});
            }
        }

        if (this.listenerCount(event.type) == 0) {
            return this.emit(EventMessenger.events.error, {title: `Unknown event type: ${event.type}`, details: event})
        }

        debug(`emitting event: ${event.type}`);
        return this.emit(event.type, event);
    }
}