import {ConnectionHelper, SocketCallback} from "./connection_helper";
import * as net from "net";
import {loggerFor, debugFor} from "../utils/logger";
import {ErrorCallback} from "../utils/interfaces";
import {AuthorisationHelper} from "./authorisation_helper";

const logger = loggerFor('ConstantServer');
const debug = debugFor('syncrow:con:constant_server');

export default class ConstantServer implements ConnectionHelper {

    private server:net.Server;
    private awaitingCallback:SocketCallback;

    constructor(private port:number, private params:{constantToken?:string, authTimeout:number}) {
        this.server = net.createServer();
        this.server.on('connection',
            (socket:net.Socket)=>this.handleConnection(socket)
        );
    }

    /**
     * Starts the constant server
     * @param callback
     */
    public listen(callback:ErrorCallback) {
        this.server.listen(this.port, callback)
    }

    /**
     */
    public shutdown() {
        this.awaitingCallback = null;
        this.server.close();
    }

    /**
     * @param params
     * @param callback
     * @returns {number}
     */
    public getNewSocket(params:{}, callback:SocketCallback):any {
        if (this.awaitingCallback) {
            return setImmediate(callback, new Error('Callback already awaiting a socket'));
        }

        this.awaitingCallback = callback;
    }

    private handleConnection(socket:net.Socket) {
        if (!this.awaitingCallback) {
            logger.error('Got a socket that was not ordered - it will be rejected');
            return socket.destroy();
        }

        const serverCallback = this.awaitingCallback;
        this.awaitingCallback = null;

        if (!this.params.constantToken) {
            debug(`#handleConnection - finished without authorisation`);
            return serverCallback(null, socket);
        }
        debug(`#handleConnection - starting authorisation with ${this.params.constantToken}`);

        return AuthorisationHelper.authorizeAsServer(socket,
            this.params.constantToken,
            {timeout: this.params.authTimeout},
            (err)=> {
                if (err) {
                    debug(`#handleConnection - destroying connection`);
                    socket.destroy();
                    return serverCallback(err);
                }

                debug(`#handleConnection - finished authorisation with ${this.params.constantToken}`);
                return serverCallback(null, socket);
            }
        );
    }
}