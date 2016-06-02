/// <reference path="../../typings/main.d.ts" />

import {EventEmitter} from "events";
import {Socket, connect} from "net";
import config from "../configuration";
import {loggerFor, debugFor} from "../utils/logger";

const debug = debugFor("syncrow:connection");
const logger = loggerFor('Connection');

export enum ConnectionStrategy{
    onProblemAbort,
    onProblemReconnectToRemote,
    onProblemListenForConnection
}

export class Connection extends EventEmitter {

    public static events = {
        data: 'data',
        connected: 'connected',
        disconnected: 'disconnected',
        reconnecting: 'reconnecting',
    };

    static reconnectionInterval = config.connectionHelper.reconnectionInterval;

    private remotePort:number;
    private remoteHost:string;
    private strategy:ConnectionStrategy;
    private socket:Socket;
    private connected:boolean;

    /**
     * Used to mantain
     * @param socket
     * @param strategy
     * @param remotePort
     * @param remoteHost
     */
    constructor(socket:Socket, strategy = ConnectionStrategy.onProblemAbort, remotePort?:number, remoteHost?:string) {
        super();
        this.remoteHost = remoteHost;
        this.remotePort = remotePort;
        this.strategy = strategy;
        this.validateStrategy();
        this.connected = false;
        this.addSocket(socket);
    }

    /**
     * @param socket
     */
    public addSocket(socket:Socket) {
        this.socket = socket;
        this.socket.on('data', (data)=>this.emit(Connection.events.data, data));
        this.socket.on('error', (error)=>this.handleSocketProblem(error));
        this.socket.on('close', (error)=>this.handleSocketProblem(error));
        this.connected = true;
    }

    /**
     * @returns {boolean}
     */
    public isConnected():boolean {
        return this.connected;
    }

    /**
     * @returns {string}
     */
    public address():string {
        return this.socket.localAddress;
    }

    /**
     * @param data
     */
    public write(data:string) {
        this.socket.write(data);
    }

    private validateStrategy() {
        if (this.strategy == ConnectionStrategy.onProblemReconnectToRemote) {
            if (!this.remoteHost || !this.remotePort) {
                throw new Error(`Invalid strategy: ${this.strategy}`);
            }
        }
    }

    private handleSocketProblem(error?:Error) {
        logger.error(error);

        if (this.strategy === ConnectionStrategy.onProblemAbort) {
            this.destroySocket();
            this.emit(Connection.events.disconnected);
            return;
        }

        if (this.strategy === ConnectionStrategy.onProblemReconnectToRemote) {
            this.destroySocket();
            this.getNewSocketAsClient((err, socket)=> {

                if (err) {
                    logger.error(err);
                    return this.emit(Connection.events.disconnected);
                }

                this.addSocket(socket);
            });
            return;
        }

        if (this.strategy === ConnectionStrategy.onProblemListenForConnection) {
            this.destroySocket();
            this.emit(Connection.events.reconnecting);
            return;
        }
    }

    private destroySocket() {
        this.socket.removeAllListeners();
        this.socket.destroy();
        delete this.socket;
    }

    private getNewSocketAsClient(socketObtainedCallback:(err:Error, socket:Socket)=>any) {

        let hasToRetry = true;
        let socket;

        async.whilst(()=>hasToRetry,

            (callback)=> {
                socket = connect(this.remotePort, this.remoteHost, ()=> {

                    logger.info(`/getNewSocketAsClient - connected with ${this.remoteHost}:${this.remotePort}`);
                    hasToRetry = false;
                    callback();

                }).once('error', (error)=> {
                    debug(`/getNewSocketAsClient - not connected, reason: ${error}`);
                    logger.info(`/getNewSocketAsClient - could not connect - next connection attempt in ${Connection.reconnectionInterval} milliseconds`);

                    setTimeout(()=>callback(), Connection.reconnectionInterval);
                })
            },

            ()=>socketObtainedCallback(null, socket)
        );
    }
}

export function getActiveConnection(host:string, port:number, callback:(err:Error, connection?:Connection)=>any) {
    connect({port: port, host: host},
        (socket)=> {
            callback(null, new Connection(socket, ConnectionStrategy.onProblemReconnectToRemote, port, host));
        }
    ).on('error', (err)=>callback(err));
}
