import {EventEmitter} from "events";
import {loggerFor, debugFor, Closable} from "../utils/logger";
import {ParseHelper} from "./parse_helper";
import {Socket} from "net";
import {ConnectionHelper, ConnectionHelperParams} from "./connection_helper";

const debug = debugFor("syncrow:connection:messenger");
const logger = loggerFor('Messenger');

export interface MessengerParams extends ConnectionHelperParams {
    reconnect:boolean;
}

export class Messenger extends EventEmitter implements Closable {

    private socket:Socket;
    private isAlive:boolean;
    private parseHelper:ParseHelper;

    static events = {
        message: 'message',
        died: 'disconnected',
        recovering: 'reconnecting',
        reconnected: 'reconnected'
    };

    /**
     * Enables sending string messages between parties
     * @param params
     * @param socket
     * @param connectionHelper
     */
    constructor(private params:MessengerParams, socket:Socket, private connectionHelper:ConnectionHelper) {
        super();
        this.addSocket(socket);
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

        this.parseHelper.writeMessage(data);
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
        this.connectionHelper.shutdown();
        delete this.connectionHelper;
    }

    private addSocket(socket:Socket) {
        this.socket = socket;
        this.socket.on('error', (error)=>this.handleSocketProblem(error));
        this.socket.on('close', (error)=>this.handleSocketProblem(error));
        this.isAlive = true;
        this.parseHelper = this.createParser(socket);

        debug(`Added a new socket`);
    }

    private createParser(socket:Socket):ParseHelper {
        const parser = new ParseHelper(socket);
        parser.on(ParseHelper.events.message, (message)=>this.emit(Messenger.events.message, message));

        return parser;
    }

    private handleSocketProblem(error?:Error) {
        logger.error(error);
        this.disconnectAndDestroyCurrentSocket();

        if (!this.params.reconnect) {
            this.emit(Messenger.events.died);
            return;
        }

        this.emit(Messenger.events.recovering);

        return this.tryToConnect();
    }

    private tryToConnect() {
        return this.connectionHelper.getNewSocket(
            (err, socket)=> {

                if (err) {
                    logger.error(`Could not reconnect - reason ${err}`);
                    return this.emit(Messenger.events.died);
                }

                this.addSocket(socket);
                return this.emit(Messenger.events.reconnected);
            }
        )
    }

    private disconnectAndDestroyCurrentSocket() {
        this.isAlive = false;

        if (this.socket) {
            this.socket.removeAllListeners();
            this.socket.destroy();
            delete this.socket;
        }
    }
}
