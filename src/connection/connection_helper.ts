import {Socket, Server, createServer, connect} from "net";
import {loggerFor, debugFor, Closable} from "../utils/logger";
import {AuthorisationHelper} from "../security/authorisation_helper";
import * as async from "async";

const debug = debugFor("syncrow:connection:helper");
const logger = loggerFor('ConnectionServer');

export interface ConnectionAddress {
    remotePort:number;
    remoteHost:string;
    token?:string;
}

export interface ListenCallback {
    (address:ConnectionAddress):any;
}

export interface SocketCallback {
    (err:Error, socket?:Socket):any;
}

export interface ConnectionHelperParams {
    remotePort?:number;
    remoteHost?:string;
    localHost?:string;
    localPort?:string;
    listen?:boolean
    override?:boolean;
    token?:string;
    interval?:number;
    times?:number;
    authenticate?:boolean;
    timeout?:number;
    listenCallback?:ListenCallback;
}

export class ConnectionHelper implements Closable {

    private params:ConnectionHelperParams;
    private server:Server;
    private serverCallback:SocketCallback;

    /**
     * @param params
     * @param host
     */
    constructor(params:ConnectionHelperParams, private host?:string) {
        this.params = this.validateAndUpdateParams(params);
    }


    /**
     * Disables the helper, calls any remaining callback with error
     */
    public shutdown() {
        logger.info('Connection Helper closing');
        this.killServer();
    }

    /**
     * @param callback
     * @param params
     */
    public setupServer(callback:(server?:Server)=>any, params?:ConnectionHelperParams) {
        try {
            params = this.validateAndUpdateParams(params);
        } catch (e) {
            return callback(e);
        }

        return this.createLastingServer(params, callback);
    }

    /**
     * @param params
     * @param callback
     */
    public getNewSocket(callback:SocketCallback, params?:ConnectionHelperParams):any {
        try {
            params = this.validateAndUpdateParams(params);
        } catch (e) {
            return callback(e);
        }

        if (this.server) {
            if (this.serverCallback) logger.error('Overwriting an existing callback');

            return this.serverCallback = this.createServerCallback(callback, params);
        }

        if (params.listen) {
            return this.createOneTimeServerAndHandleConnection(params, params.listenCallback, callback);
        }

        if (params.times && params.interval) {
            return async.retry({times: params.times, interval: params.interval},

                (cb)=>this.getSocketByConnecting(params, cb),

                callback
            )
        }
        return this.getSocketByConnecting(params, callback);
    }

    private validateAndUpdateParams(params:ConnectionHelperParams) {
        params = params ? params : {};

        if (!params.override) {
            params = _.extend(this.params, params);
        }

        if (params.authenticate && !params.token) {
            params.token = AuthorisationHelper.generateToken();
        }

        if (params.token && !params.timeout) {
            throw new Error('timeout is needed when authorisation is on');
        }

        if (!params.listen && !params.remoteHost) {
            throw new Error('remoteHost is missing for connection');
        }

        if (!params.listen && !params.remotePort) {
            throw new Error('remotePort is missing for connection');
        }

        if (params.listen && !params.listenCallback) {
            throw new Error('listenCallback is needed for listening');
        }

        if (params.times || params.interval) {
            if (!params.times) throw new Error('times needed when interval is set');
            if (!params.interval) throw  new Error('interval needed when times is set');
        }

        return params;
    }

    private createServerCallback(callback:SocketCallback, params:ConnectionHelperParams) {
        return (err, socket)=> {

            if (err) {
                delete this.serverCallback;
                return callback(err);
            }
            return this.handleIncomingSocket(socket, params,
                (err, socket)=> {
                    delete this.serverCallback;
                    return callback(err, socket);
                }
            );
        }
    }

    private getSocketByConnecting(params:ConnectionHelperParams, callback:(err:Error, socket?:Socket)=>any) {
        const socket = connect({port: params.remotePort, host: params.remoteHost},
            (err)=> {
                if (err)return callback(err);

                if (params.token) {
                    return AuthorisationHelper.authorizeToSocket(socket, params.token, {timeout: params.timeout},
                        (err)=> {
                            if (err) return callback(err);

                            return callback(null, socket);
                        }
                    );
                }

                return callback(null, socket);
            }
        );
    }

    private createOneTimeServerAndHandleConnection(params:ConnectionHelperParams, listenCallback:ListenCallback, connectedCallback:SocketCallback) {
        return this.createNewServer(params,

            (server)=> {

                listenCallback({
                    remotePort: server.address().port,
                    remoteHost: params.localHost,
                    token: params.token
                });

                server.on('connection',
                    (socket)=> this.handleIncomingSocket(socket, params,
                        (err, socket)=> {
                            if (err)return connectedCallback(err);

                            debug('Got a new socket - closing the one time server');
                            server.close();
                            return connectedCallback(null, socket)
                        }
                    )
                );

                server.on('error', connectedCallback);
            }
        )
    }

    private createLastingServer(params:ConnectionHelperParams, callback:(server:Server)=>any) {
        return this.createNewServer(params,

            (server)=> {
                this.server = server;

                this.server.on('connection',
                    (socket:Socket)=> {
                        const serverCallback = this.serverCallback;
                        if (serverCallback) {
                            delete this.serverCallback;
                            return serverCallback(null, socket);
                        }

                        logger.error('Got a socket that was not ordered - it will be rejected');
                        return socket.destroy();
                    }
                );

                this.server.on('error', (err)=> {
                    const serverCallback = this.serverCallback;
                    if (serverCallback) {
                        serverCallback(err);
                        delete this.serverCallback
                    }
                    else logger.error(`Server emitted error: ${err}`);

                    this.killServer();
                });

                return callback(server);
            }
        )
    }


    private createNewServer(params:ConnectionHelperParams, callback:(server:Server)=>any) {
        const listenOptions:any = {};

        if (params.localHost) listenOptions.host = params.localHost;
        if (params.localPort) listenOptions.port = params.localPort;

        const server = createServer().listen(listenOptions,
            ()=> {
                return callback(server)
            }
        );
    }

    private handleIncomingSocket(socket:Socket, params:ConnectionHelperParams, connectedCallback:SocketCallback) {
        if (params.token) {
            return AuthorisationHelper.authorizeSocket(socket, params.token, {timeout: params.timeout},
                (err)=> {
                    if (err) return connectedCallback(err);

                    return connectedCallback(null, socket);
                }
            )
        }

        return connectedCallback(null, socket);
    }

    private killServer() {
        this.server.close();
        delete this.server;
        delete this.serverCallback;
    }
}