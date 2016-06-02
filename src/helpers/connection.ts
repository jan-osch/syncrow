/// <reference path="../../typings/main.d.ts" />

import Logger = require('./logger');
import net = require('net');
import {EventEmitter} from "events";
import {Socket} from "net";
import Configuration = require('../configuration');
import errorPrinter = require('../utils/error_printer');

const debug = require("debug")("syncrow:connection");

let logger = Logger.getNewLogger('Connection', Configuration.connectionHelper.logLevel);

enum ConnectionStrategy{
    onProblemAbort,
    onProblemReconnectToRemote,
    onProblemListenForConnection
}

class Connection extends EventEmitter {

    public static events = {
        data: 'data',
        connected: 'connected',
        disconnected: 'disconnected',
        reconnecting: 'reconnecting',
    };

    static reconnectionInterval = Configuration.connectionHelper.reconnectionInterval;

    private remotePort:number;
    private remoteHost:string;
    private strategy:ConnectionStrategy;
    private socket:Socket;
    private connected:boolean;

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

    private validateStrategy() {
        if (this.strategy == ConnectionStrategy.onProblemReconnectToRemote) {
            if (!this.remoteHost || !this.remotePort) {
                throw new Error(`Invalid strategy: ${this.strategy}`);
            }
        }
    }

    private handleSocketProblem(error?:Error) {
        errorPrinter(error);

        if (this.strategy === ConnectionStrategy.onProblemAbort) {
            this.destroySocket();
            this.emit(Connection.events.disconnected);
            return;
        }

        if (this.strategy === ConnectionStrategy.onProblemReconnectToRemote) {
            this.destroySocket();
            this.getNewSocketAsClient((err, socket)=> {

                if (err) {
                    errorPrinter(err);
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
                socket = net.connect(this.remotePort, this.remoteHost, ()=> {

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

export  = Connection;

