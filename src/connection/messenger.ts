import {EventEmitter} from "events";
import {Connection} from "./connection";
import {loggerFor, debugFor} from "../utils/logger";
import {ParseHelper} from "./parse_helper";
import {Socket} from "net";
import {ConnectionHelper} from "./connection_helper";

const debug = debugFor("syncrow:connection:messenger");
const logger = loggerFor('Messenger');

export interface MessangerParams {
    port?:number
    host?:string
    listen?:boolean
    reconnect?:boolean
    interval?:number
    retries?:number
}

export class Messenger extends EventEmitter {

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
     * @param connection
     */
    constructor(private params:MessangerParams, callback?:ErrorCallback) {
        super();
        this.parseHelper = this.createParser();

        this.initializeConnectionHelper(this.params, callback)
    }

    private createParser():ParseHelper {
        const parser = new ParseHelper();
        parser.on(ParseHelper.events.message, (message)=>this.emit(message));

        return parser;
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

        this.connection.write(ParseHelper.prepareMessage(data));
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
        return this.connection.address();
    }

    private addListenersToConnection(connection:Connection) {
        debug('/addListenersToConnection - adding listeners to new socket');

        this.connection = connection;
        this.connection.on(Connection.events.data, (data)=>this.parseHelper.parseData(data));
        this.connection.on(Connection.events.disconnected, ()=> this.handleConnectionDied());
        this.connection.on(Connection.events.reconnecting, ()=> this.handleConnectionRecovering());
        this.connection.on(Connection.events.connected, ()=>this.handleConnectionAlive());

        if (this.connection.isConnected()) {
            this.handleConnectionAlive();
        }
    }

    public addSocket(socket:Socket) {
        this.socket = socket;
        this.socket.on('error', (error)=>this.handleSocketProblem(error));
        this.socket.on('close', (error)=>this.handleSocketProblem(error));
        this.socket.on('data', (data)=>this.emit(Connection.events.data, data));
        this.connected = true;
        this.emit(Connection.events.connected);
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

    private initializeConnectionHelper(params:MessangerParams, callback:ErrorCallback) {
        async.series(
            [
                (cb)=> {
                    this.connectionHelper = new ConnectionHelper(params, cb)
                },

                (cb)=> {
                    this.connectionHelper.getNewSocket((err, socket)=> {
                        if (err)return cb(err);

                        this.socket = socket;
                        return cb();
                    })
                }
            ],

            callback
        )
    }
}
