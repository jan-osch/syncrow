/// <reference path="../typings/main.d.ts" />

import net = require('net');
import events = require('events');
import Logger = require('./helpers/logger');
import ConnectionHelper = require("./helpers/connection_helper");
import {Socket} from "net";

let logger = Logger.getNewLogger('SocketMessenger');


class SocketMessenger extends events.EventEmitter {
    socket:net.Socket;
    connectionHelper:ConnectionHelper;
    messageBuffer:string;
    expectedLength:number;
    separator = ':';
    connected:boolean;

    static events = {
        message: 'message',
        connected: 'connected',
        disconnected: 'disconnected'
    };

    constructor(connectionHelper:ConnectionHelper) {
        super();
        this.resetBuffers();
        this.connected = false;
        this.socket = null;
        this.connectionHelper = connectionHelper;

        this.obtainNewSocket();
    }

    obtainNewSocket() {
        this.connectionHelper.once(ConnectionHelper.events.socket, (socket)=> {
            logger.debug('/obtainNewSocket- adding new socket');
            this.socket = socket;
            this.connected = true;
            this.addListenersToSocket(this.socket);
        });

        logger.debug('/obtainNewSocket- requesting new socket');
        this.connectionHelper.getSocket();
    }

    public writeData(data:string) {
        if (!this.connected) {
            return logger.warn('/writeData - socket connection is closed will not write data')
        }
        var message = `${data.length}${this.separator}${data}`;
        this.socket.write(message);

    }

    private resetBuffers() {
        this.messageBuffer = '';
        this.expectedLength = null;
    }

    private addListenersToSocket(socket:Socket) {
        logger.debug('/addListenersToSocket - adding listeners to new socket');
        socket.on('data', (data)=>this.parseData(data));
        socket.on('close', ()=> this.handleSocketDisconnected());

        this.emit(SocketMessenger.events.connected);
    }

    handleSocketDisconnected() {
        logger.debug('socket connection closed');
        this.connected = false;
        this.obtainNewSocket();
        this.emit(SocketMessenger.events.disconnected);
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
            this.emit(SocketMessenger.events.message, this.messageBuffer.slice(0, this.expectedLength));
            this.restartParsingMessage(this.messageBuffer.slice(this.expectedLength));
        }
    }

    private restartParsingMessage(remainder:string) {
        this.resetBuffers();
        this.messageBuffer = remainder;
        this.checkIfExpectedLengthArrived();
        this.checkIfMessageIsComplete();
    }

    public getOwnHost():string {
        return this.socket.address().address;
    }
}

export = SocketMessenger;
