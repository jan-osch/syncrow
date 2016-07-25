import {EventEmitter} from "events";
import {loggerFor, debugFor, Closable} from "../utils/logger";
import {ParseHelper} from "./parse_helper";
import {Socket} from "net";
import {ConnectionHelper, ConnectionHelperParams} from "./connection_helper";

const debug = debugFor("syncrow:connection:messenger");
const logger = loggerFor('Messenger');

export interface MessengerParams {
    port?:number
    host?:string
    listen?:boolean
    reconnect?:boolean
    interval?:number
    retries?:number
    await?:boolean
}

export class Messenger extends EventEmitter implements Closable {

    private socket:Socket;
    private isAlive:boolean;
    private parseHelper:ParseHelper;
    private connectionHelper:ConnectionHelper;


    static events = {
        message: 'message',
        alive: 'connected',
        died: 'disconnected',
        recovering: 'reconnecting'
    };

    /**
     * Enables sending string messages between parties
     * @param params
     * @param callback
     */
    constructor(private params:MessengerParams, callback?:ErrorCallback) {
        super();
        this.parseHelper = this.createParser();
        this.initializeConnectionHelper(this.params, callback)
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

        this.socket.write(ParseHelper.prepareMessage(data));
    }

    /**
     * @returns {boolean}
     */
    public isMessengerAlive() {
        return this.isAlive;
    }

    /**
     * @returns {string}
     */
    public getOwnHost():string {
        return this.params.host;
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

    /**
     * @param params
     * @param callback
     */
    public getAndAddNewSocket(params:ConnectionHelperParams, callback:ErrorCallback) {
        this.connectionHelper.getNewSocket(params, (err, socket)=> {
            if (err)return callback(err);

            this.addSocket(socket);
            return callback();
        })
    }

    private addSocket(socket:Socket) {
        this.socket = socket;
        this.socket.on('error', (error)=>this.handleSocketProblem(error));
        this.socket.on('close', (error)=>this.handleSocketProblem(error));
        this.socket.on('data', (data)=>this.parseHelper.parseData(data));
        this.isAlive = true;
        this.emit(Messenger.events.alive);

        debug(`Added a new socket`);
    }

    private createParser():ParseHelper {
        const parser = new ParseHelper();
        parser.on(ParseHelper.events.message, (message)=>this.emit(message));

        return parser;
    }

    private initializeConnectionHelper(params:MessengerParams, callback:ErrorCallback) {
        async.series(
            [
                (cb)=> {
                    this.connectionHelper = new ConnectionHelper(params, cb)
                },

                (cb)=> this.getAndAddNewSocket(params, cb)
            ],

            callback
        )
    }

    private handleSocketProblem(error?:Error) {
        logger.error(error);
        this.disconnectAndDestroyCurrentSocket();

        if (!this.params.reconnect) {
            this.emit(Messenger.events.died);
            return;
        }

        this.emit(Messenger.events.recovering);

        if (this.params.await) {
            debug('awaiting exeternal command to reconnect');
            return;
        }

        return this.tryToConnect();
    }

    private tryToConnect() {
        async.retry(
            {
                times: this.params.retries,
                interval: this.params.interval
            },

            (cb)=> {
                logger.info('Attempting to reconnect');
                return this.getAndAddNewSocket(this.params, cb);
            },

            (err)=> {
                if (err) {
                    logger.error(`Could not reconnect - reason ${err}`);
                    this.emit(Messenger.events.died);
                }
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
