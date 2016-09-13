import {ConnectionHelper, SocketCallback, ListenCallback} from "./connection_helper";
import * as net from "net";
import {loggerFor, debugFor} from "../utils/logger";
import {AuthorisationHelper} from "./authorisation_helper";

const debug = debugFor('syncrow:con:dynamic_server');

export default class DynamicServer implements ConnectionHelper {

    private oneTimeServers:Set<net.Server>;

    constructor(private params:{constantToken?:string, authorisationTimeout?:number, generateToken?:boolean},
                private externalHost:string) {
        this.oneTimeServers = new Set<net.Server>();
    }

    /**
     */
    public shutdown() {
        this.oneTimeServers.forEach(s =>s.close())
    }

    /**
     * @param params
     * @param callback
     * @returns {number}
     */
    public getNewSocket(params:{listenCallback:ListenCallback}, callback:SocketCallback):any {
        debug('#getNewSocket called');

        const server = net.createServer();
        this.oneTimeServers.add(server);

        const actualToken = this.getToken();

        server.on('connection',
            (socket)=> this.handleConnection(server, actualToken, socket, callback)
        );

        server.listen(()=> {
            params.listenCallback({
                remotePort: server.address().port,
                remoteHost: this.externalHost,
                token: actualToken
            })
        })
    }

    private handleConnection(server:net.Server, actualToken:string, socket:net.Socket, callback:SocketCallback) {
        this.oneTimeServers.delete(server);
        server.close();

        if (!actualToken) {
            debug(`#handleConnection - finished without authorisation`);
            return callback(null, socket);
        }

        debug(`#handleConnection - starting authorisation with ${actualToken}`);
        return AuthorisationHelper.authorizeAsServer(socket,
            actualToken,
            {timeout: this.params.authorisationTimeout},
            (err)=> {

                if (err) {
                    socket.destroy();
                    return callback(err);
                }

                debug(`#handleConnection - finished authorisation with ${actualToken}`);
                return callback(null, socket);
            }
        )
    }

    private getToken():string {
        if (this.params.constantToken) return this.params.constantToken;

        if (this.params.generateToken) return AuthorisationHelper.generateToken();
    }
}