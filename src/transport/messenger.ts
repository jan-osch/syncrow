/// <reference path="../../typings/main.d.ts" />

import {EventEmitter} from "events";
import {Connection} from "./connection";
import {loggerFor, debugFor} from "../utils/logger";

const debug = debugFor("syncrow:messenger");
const logger = loggerFor('Messenger');

export class Messenger extends EventEmitter {

    private connection:Connection;

    private isAlive:boolean;
    private messageBuffer:string;
    private expectedLength:number;

    private static separator = ':';

    static events = {
        message: 'message',
        alive: 'connected',
        died: 'disconnected',
        recovering: 'reconnecting'
    };

    /**
     * Enables sending string messages between parties
     * @param connection
     */
    constructor(connection:Connection) {
        super();
        this.resetBuffers();
        this.addListenersToConnection(connection);
    }

    /**
     *
     * @param data
     * @returns
     */
    public writeMessage(data:string) {
        if (!this.isAlive) {
            return logger.warn('/writeMessage - socket connection is closed will not write data')
        }
        var message = `${data.length}${Messenger.separator}${data}`;
        this.connection.write(message);
    }

    /**
     * @returns {string}
     */
    public getOwnHost():string {
        return this.connection.address().address;
    }

    private resetBuffers() {
        this.messageBuffer = '';
        this.expectedLength = null;
    }

    private addListenersToConnection(connection:Connection) {
        debug('/addListenersToConnection - adding listeners to new socket');

        this.connection = connection;
        this.connection.on(Connection.events.data, (data)=>this.parseData(data));
        this.connection.on(Connection.events.disconnected, ()=> this.handleConnectionDied());
        this.connection.on(Connection.events.reconnecting, ()=> this.handleConnectionRecovering());
        this.connection.on(Connection.events.connected, ()=>this.handleConnectionAlive());

        if (this.connection.isConnected()) {
            this.handleConnectionAlive();
        }
    }

    private handleConnectionDied() {
        debug('connection disconnected');
        this.isAlive = false;
        this.emit(Messenger.events.died);
    }

    private handleConnectionRecovering() {
        debug('connection is reconnecting');
        this.isAlive = false;
        this.emit(Messenger.events.recovering);
    }

    private handleConnectionAlive() {
        debug('connection connected');
        this.isAlive = true;
        this.emit(Messenger.events.alive);
    }

    private parseData(data:Buffer) {
        this.messageBuffer += data.toString();
        if (this.expectedLength === null) {
            this.checkIfExpectedLengthArrived();
        }
        this.checkIfMessageIsComplete();
    }

    private checkIfExpectedLengthArrived() {
        var indexOfContentLengthHeaderSeparator = this.messageBuffer.indexOf(Messenger.separator);
        if (indexOfContentLengthHeaderSeparator !== -1) {
            this.expectedLength = parseInt(this.messageBuffer.slice(0, indexOfContentLengthHeaderSeparator));
            this.messageBuffer = this.messageBuffer.slice(indexOfContentLengthHeaderSeparator + 1);
        }
    }

    private checkIfMessageIsComplete() {
        if (this.expectedLength && this.messageBuffer.length >= this.expectedLength) {
            this.emit(Messenger.events.message, this.messageBuffer.slice(0, this.expectedLength));
            this.restartParsingMessage(this.messageBuffer.slice(this.expectedLength));
        }
    }

    private restartParsingMessage(remainder:string) {
        this.resetBuffers();
        this.messageBuffer = remainder;
        this.checkIfExpectedLengthArrived();
        this.checkIfMessageIsComplete();
    }
}
