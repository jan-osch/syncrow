/// <reference path="../../typings/main.d.ts" />

import Logger = require('./logger');
import net = require('net');
import {EventEmitter} from "events";
import {Server, Socket} from "net";
import Configuration = require('../configuration');

let logger = Logger.getNewLogger('ConnectionHelper', Configuration.connectionHelper.logLevel);

class ConnectionHelper extends EventEmitter {
    port:number;
    host:string;
    isServer:boolean;
    server:Server;
    static reconnectionInterval = Configuration.connectionHelper.reconnectionInterval;

    static events = {
        socket: 'socket',
        error: 'error'
    };

    constructor(port:number, host:string, server:boolean) {
        super();
        this.host = host;
        this.port = port;
        this.isServer = server;
    }

    public getSocket() {
        if (this.isServer && !this.server) {
            return this.initializeServer()
        } else if (this.isServer) {
            return logger.debug('/getSocket - server already initialized - waiting for socket to connect');
        }

        return this.getNewSocketAsClient();
    }

    private initializeServer() {
        this.server = net.createServer((socket)=> this.handleNewSocketAsServer(socket))
            .listen({port: this.port}, ()=> {
                logger.debug(`/getNewSocketAsServer - server listening on port ${this.port}`);
            });
    }

    private handleNewSocketAsServer(socket:Socket) {
        logger.debug('/handleNewSocketAsServer - new socket connected');
        this.emit(ConnectionHelper.events.socket, socket);
    }

    private getNewSocketAsClient() {
        let socket = net.connect(this.port, this.host, ()=> {
            logger.info(`/getNewSocketAsClient - connected with ${this.host}:${this.port}`);
            this.emit(ConnectionHelper.events.socket, socket);
        }).once(ConnectionHelper.events.error, (error)=> {
            logger.debug(`/getNewSocketAsClient - not connected, reason: ${error}`);
            logger.info(`/getNewSocketAsClient - could not connect - next connection attempt in ${ConnectionHelper.reconnectionInterval} milliseconds`);
            setTimeout(()=>this.getNewSocketAsClient(), ConnectionHelper.reconnectionInterval);
        })
    }
}

export  = ConnectionHelper;

