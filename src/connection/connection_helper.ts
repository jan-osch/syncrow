import {Socket, Server, createServer, connect} from "net";
import {loggerFor, debugFor, Closable} from "../utils/logger";

const debug = debugFor("syncrow:connection:server");
const logger = loggerFor('ConnectionServer');

export interface ConnectionHelperParams {
    port?:number
    host?:string
    listen?:boolean
}

export class ConnectionHelper implements Closable {
    private server:Server;
    private host:string;
    private port:number;
    private listen:boolean;
    private callbackAwaitingSocket:(err:Error, socket?:Socket)=>any;

    /**
     * @param params
     * @param callback
     */
    constructor(params:ConnectionHelperParams, callback:ErrorCallback) {
        this.host = params.host;
        this.port = params.port;
        this.listen = params.listen;
        this.callbackAwaitingSocket = null;

        if (this.listen) {
            this.initializeServer(callback);
        } else {
            callback();
        }
    }

    /**
     * Needed for strategy onProblemListenForConnection
     * @param callback
     */
    initializeServer(callback:ErrorCallback) {
        this.server = createServer(
            (socket:Socket)=> this.handleNewSocket(socket)
        ).listen(this.port, callback);
    }

    /**
     * Disables the helper, calls any remaining callback with error
     */
    public shutdown() {
        logger.info('Connection Helper closing');
        if (this.server) {
            this.server.destroy();
            delete this.server;
        }
        if (this.callbackAwaitingSocket) {
            this.callbackAwaitingSocket(new Error('Helper is closed'));
            delete this.callbackAwaitingSocket;
        }
    }

    /**
     * @param params
     * @param callback
     */
    public getNewSocket(params:ConnectionHelperParams, callback:(err:Error, socket?:Socket)=>any) {
        if (this.listen) {
            return this.getSocketFromServer(callback);
        }

        return this.getSocketByConnecting(params, callback);
    }

    private getSocketByConnecting(params:ConnectionHelperParams, callback:(err:Error, socket?:Socket)=>any) {
        const socket = connect({port: params.port, host: params.host},
            (err)=> {
                if (err)return callback(err);
                return callback(null, socket);
            }
        );
    }

    private handleNewSocket(socket:Socket) {
        if (this.callbackAwaitingSocket) {
            this.callbackAwaitingSocket(null, socket);
            delete this.callbackAwaitingSocket;
        }

        debug('New socket connected - it will be rejected');
        socket.end('Connection refused');
    }

    private getSocketFromServer(callback:(err:Error, socket?:Socket)=>any) {
        this.callbackAwaitingSocket = callback;
    }
}