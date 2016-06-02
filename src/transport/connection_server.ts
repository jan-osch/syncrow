/// <reference path="../../typings/main.d.ts" />

import {Socket, Server, createServer} from "net";
import {Connection, ConnectionStrategy} from "./connection";
import {loggerFor, debugFor} from "../utils/logger";

const debug = debugFor("syncrow:connection_server");
const logger = loggerFor('ConnectionServer');

//TODO add configuration connection retries
export class ConnectionServer {
    private connection:Connection;
    private server:Server;
    private initialCallbackCalled:boolean;
    private connectionAwaitingNewSocket:boolean;

    /**
     * Needed for strategy onProblemListenForConnection
     * @param port
     * @param initialCallback
     */
    constructor(port:number, initialCallback:(err:Error, connection?:Connection)=>any) {

        this.server = createServer(
            (socket:Socket)=> this.connectSocket(socket, initialCallback)
        ).listen(port, ()=> {
            debug(`listening on port ${port}`);
        });

        this.server.on('error', (err)=> {
            if (!this.initialCallbackCalled) {
                this.server.destroy();
                this.initialCallbackCalled = true;
                initialCallback(err);

            } else {
                logger.error(err);
            }
        });
    }

    private connectSocket(socket:Socket, initialCallback:(err:Error, connection?:Connection)=>any) {
        if (!this.connection) {
            this.connection = new Connection(socket, ConnectionStrategy.onProblemListenForConnection);

            this.connection.on(Connection.events.reconnecting, ()=> {
                this.connectionAwaitingNewSocket = true;
            });

            this.initialCallbackCalled = true;
            initialCallback(null, this.connection);
            return;
        }

        if (this.connection && !this.connectionAwaitingNewSocket) {
            logger.error('Invalid state - connected, when previous connection is still active');
            return;
        }

        if (this.connection && this.connectionAwaitingNewSocket) {
            debug(`got new socket for connection`);
            this.connection.addSocket(socket);
            return;
        }
    }
}