import {EventEmitter} from "events";
import {Socket} from "net";
import {debugFor} from "../utils/logger";
import {Closable} from "../utils/interfaces";

const debug = debugFor('syncrow:connection:parse_helper');


export class ParseHelper extends EventEmitter implements Closable {
    private messageBuffer:string;

    private expectedLength:number;
    private static separator = ':';
    private listener:Function;
    private id:number;
    static events = {
        message: 'message',
    };

    /**
     * Enables sending string commands between parties
     */
    constructor(private socket:Socket) {
        super();
        this.listener = (data)=>this.parseData(data);
        this.resetBuffers();
        this.socket.on('data', this.listener);
        this.id = Math.floor(Math.random() * 10000)
    }

    /**
     * @param data
     * @returns {string}
     */
    public writeMessage(data:string) {
        debug(`${this.id} writing message: ${data}`);
        this.socket.write(`${data.length}${ParseHelper.separator}${data}`);
    }

    /**
     * Removes own listener from socket
     */
    public shutdown() {
        debug(`${this.id} removing listeners`);
        this.socket.removeListener('data', this.listener);
    }

    private parseData(data:Buffer) {
        this.messageBuffer += data.toString();
        if (this.expectedLength === null) {
            this.checkIfExpectedLengthArrived();
        }
        this.checkIfMessageIsComplete();
    }

    private resetBuffers() {
        this.messageBuffer = '';
        this.expectedLength = null;
    }

    private checkIfExpectedLengthArrived() {
        const indexOfContentLengthHeaderSeparator = this.messageBuffer.indexOf(ParseHelper.separator);

        if (indexOfContentLengthHeaderSeparator !== -1) {
            this.expectedLength = parseInt(this.messageBuffer.slice(0, indexOfContentLengthHeaderSeparator));
            this.messageBuffer = this.messageBuffer.slice(indexOfContentLengthHeaderSeparator + 1);
        }
    }

    private checkIfMessageIsComplete() {
        if (this.expectedLength && this.messageBuffer.length >= this.expectedLength) {
            const message = this.messageBuffer.slice(0, this.expectedLength);
            debug(`${this.id}  got message: ${message}`);
            this.emit(ParseHelper.events.message, message);
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
