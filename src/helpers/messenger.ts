/// <reference path="../../typings/main.d.ts" />

import net = require('net');
import events = require('events');
import Logger = require('./logger');
import ConnectionHelper = require("./connection_helper");
import {Socket} from "net";

let logger = Logger.getNewLogger('Messenger');


class Messenger extends events.EventEmitter {

    private socket:net.Socket;
    private connectionHelper:ConnectionHelper;
    private messageBuffer:string;
    private expectedLength:number;
    private static separator = ':';
    private connected:boolean;

    static events = {
        message: 'message',
        connected: 'connected',
        disconnected: 'disconnected'
    };

    constructor(connectionHelper?:ConnectionHelper, socket?:Socket) {
        super();
        this.resetBuffers();

        if (socket) {
            this.socket = socket;
            this.connected = true;
            this.addListenersToSocketAndEmitConnected(socket);

        } else if (connectionHelper) {
            this.connected = false;
            this.socket = null;
            this.connectionHelper = connectionHelper;
            this.obtainNewSocket();
        }

    }

    /**
     *
     * @param data
     * @returns {undefined}
     */
    public writeMessage(data:string) {
        if (!this.connected) {
            return logger.warn('/writeMessage - socket connection is closed will not write data')
        }
        var message = `${data.length}${Messenger.separator}${data}`;
        this.socket.write(message);

    }

    /**
     * @returns {string}
     */
    public getOwnHost():string {
        return this.socket.address().address;
    }

    private obtainNewSocket() {
        this.connectionHelper.once(ConnectionHelper.events.socket, (socket)=> {
            logger.debug('/obtainNewSocket- adding new socket');
            this.socket = socket;
            this.connected = true;
            this.addListenersToSocketAndEmitConnected(this.socket);
        });

        logger.debug('/obtainNewSocket- requesting new socket');
        this.connectionHelper.getSocket();
    }

    private resetBuffers() {
        this.messageBuffer = '';
        this.expectedLength = null;
    }

    private addListenersToSocketAndEmitConnected(socket:Socket) {
        logger.debug('/addListenersToSocketAndEmitConnected - adding listeners to new socket');
        socket.on('data', (data)=>this.parseData(data));
        socket.on('close', ()=> this.handleSocketDisconnected());

        this.emit(Messenger.events.connected);
    }

    private handleSocketDisconnected() {
        logger.debug('socket connection closed');
        this.connected = false;
        this.obtainNewSocket();
        this.emit(Messenger.events.disconnected);
    }

    private parseData(data:Buffer) {
        this.messageBuffer += data.toString();
        if (this.expectedLength === null) {
            this.checkIfExpectedLengthArrived();
        }
        this.checkIfMessageIsComplete();
    }

    private checkIfExpectedLengthArrived() {
        var indexOfContentLengthHeaderSeparator = this.messageBuffer.indexOf(this.separator);
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

export = Messenger;
