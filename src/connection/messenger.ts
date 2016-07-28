import {EventEmitter} from "events";
import {loggerFor, debugFor, Closable} from "../utils/logger";
import {ParseHelper} from "./parse_helper";
import {Socket} from "net";
import {ConnectionHelper, ConnectionHelperParams} from "./connection_helper";
import {AuthorisationHelper} from "../security/authorisation_helper";
import {ErrBack} from "../utils/interfaces";

const debug = debugFor("syncrow:connection:messenger");
const logger = loggerFor('Messenger');

export interface MessengerParams extends ConnectionHelperParams {
    port:number
    host?:string
    listen:boolean
    reconnect:boolean
    interval?:number
    retries?:number
    await?:boolean
    authorize?:boolean
    token?:string
    authorisationTimeout?:number
}

export class Messenger extends EventEmitter implements Closable {

    private socket:Socket;
    private isAlive:boolean;
    private parseHelper:ParseHelper;
    private connectionHelper:ConnectionHelper;


    static events = {
        message: 'message',
        died: 'disconnected',
        recovering: 'reconnecting',
        reconnected: 'reconnected'
    };

    /**
     * Enables sending string messages between parties
     * @param params
     * @param callback
     */
    constructor(private params:MessengerParams, callback?:ErrBack) {
        super();

        try {
            Messenger.validateParams(params);
        } catch (e) {
            return callback(e);
        }

        this.parseHelper = null;
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

        this.parseHelper.writeMessage(data);
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
    public getAndAddNewSocket(params:MessengerParams, callback:ErrBack) {
        async.autoInject({
                socket: (cb)=>this.connectionHelper.getNewSocket(params, cb),

                authorised: (socket, cb) => {
                    if (!params.authorize)return cb();

                    if (params.listen) return AuthorisationHelper.authorizeSocket(socket, params.token, {timeout: params.authorisationTimeout}, cb);

                    return AuthorisationHelper.authorizeToSocket(socket, params.token, {timeout: params.authorisationTimeout}, cb)
                },

                add: (socket, authorised, cb)=> {
                    this.addSocket(socket);
                    return cb();
                }
            },
            callback
        );
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
        parser.on(ParseHelper.events.message, (message)=>this.emit(message));

        return parser;
    }

    private initializeConnectionHelper(params:MessengerParams, callback:ErrBack) {
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
            debug('awaiting external command to reconnect');
            return;
        }

        return this.tryToConnect(this.params);
    }

    private tryToConnect(params:MessengerParams) {
        return async.retry(
            {
                times: params.retries,
                interval: params.interval
            },

            (cb:ErrBack)=> {
                logger.info('Attempting to reconnect');
                return this.getAndAddNewSocket(params, cb);
            },

            (err)=> {
                if (err) {
                    logger.error(`Could not reconnect - reason ${err}`);
                    return this.emit(Messenger.events.died);
                }

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

    private static validateParams(params:MessengerParams) {
        if (params.listen && !params.host) throw new Error('If not Messenger is not listening, host is needed');

        if (params.reconnect && !params.await && !params.retries) throw new Error('If Messenger has to reconnect automatically, it needs retries');

        if (params.reconnect && !params.await && !params.interval) throw new Error('If Messenger has to reconnect automatically, it needs interval');

        if (params.authorize && !params.token) throw new Error('If Messenger has to authorise it needs a token');
    }
}
