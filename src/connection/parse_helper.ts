import {EventEmitter} from "events";

export class ParseHelper extends EventEmitter {

    private messageBuffer:string;
    private expectedLength:number;

    private static separator = ':';

    static events = {
        message: 'message',
    };

    /**
     * Enables sending string messages between parties
     */
    constructor() {
        super();
        this.resetBuffers();
    }

    /**
     * @param data
     * @returns {string}
     */
    public static prepareMessage(data:string):string {
        return `${data.length}${ParseHelper.separator}${data}`;
    }

    /**
     * @param data
     */
    public parseData(data:Buffer) {
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
        var indexOfContentLengthHeaderSeparator = this.messageBuffer.indexOf(ParseHelper.separator);
        if (indexOfContentLengthHeaderSeparator !== -1) {
            this.expectedLength = parseInt(this.messageBuffer.slice(0, indexOfContentLengthHeaderSeparator));
            this.messageBuffer = this.messageBuffer.slice(indexOfContentLengthHeaderSeparator + 1);
        }
    }

    private checkIfMessageIsComplete() {
        if (this.expectedLength && this.messageBuffer.length >= this.expectedLength) {
            this.emit(ParseHelper.events.message, this.messageBuffer.slice(0, this.expectedLength));
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
