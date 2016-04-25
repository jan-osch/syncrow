/// <reference path="../typescript-interfaces/node.d.ts" />
import net = require('net');
import events = require('events');


class SocketMessenger extends events.EventEmitter {
    socket:net.Socket;
    messageBuffer:string;
    expectedLength:number;
    separator = ':';
    static messageEvent = 'message';

    constructor(host:string, port:number, socket?:net.Socket) {
        super();
        this.resetBuffers();
        if (socket) {
            this.socket = socket;
            this.socket.on('data', (data)=>this.parseData(data))
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

    private connect(host:string, port:number) {
        this.socket = net.connect(port, host, ()=> {
            console.log(`connected with ${host}:${port}`);
            this.socket.on('data', (data)=>this.parseData(data))
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
}

export = SocketMessenger;
