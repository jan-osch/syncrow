/// <reference path="../typings/main.d.ts" />

import net = require('net');
import events = require('events');
import logger = require('./logger');

//TODO add support for disconnection
class SocketMessenger extends events.EventEmitter {
    socket:net.Socket;
    messageBuffer:string;
    expectedLength:number;
    separator = ':';
    static events = {
        message: 'message',
        connected: 'connected',
        disconnected: 'disconnected'
    };
    static messageEvent = 'message';

    constructor(host:string, port:number, socket?:net.Socket) {
        super();
        this.resetBuffers();
        if (socket) {
            this.socket = socket;
            this.addListenersToSocket(this.socket)
        } else {
            this.socket = null;
            this.connect(host, port);
        }
    }

    public writeData(data:string) {
        var message = `${data.length}${this.separator}${data}`;
        this.socket.write(message);
    }

    private resetBuffers() {
        this.messageBuffer = '';
        this.expectedLength = null;
    }

    private addListenersToSocket(socket:net.Socket) {
        socket.on('data', (data)=>this.parseData(data));
        socket.on('close', ()=> {
            logger.info('socket connection disconnected');
            this.emit(SocketMessenger.events.disconnected);
        });
        this.emit(SocketMessenger.events.connected);
    }

    private connect(host:string, port:number) {
        this.socket = net.connect(port, host, ()=> {
            logger.info(`connected with ${host}:${port}`);
            this.addListenersToSocket(this.socket);
        })
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
            this.emit(SocketMessenger.messageEvent, this.messageBuffer.slice(0, this.expectedLength));
            this.restartParsingMessage(this.messageBuffer.slice(this.expectedLength));
        }
    }

    private restartParsingMessage(remainder:string) {
        this.resetBuffers();
        this.messageBuffer = remainder;
        this.checkIfExpectedLengthArrived();
        this.checkIfMessageIsComplete();
    }
    
    public getOwnHost():string{
        return this.socket.address().address;
    }
}

export = SocketMessenger;
