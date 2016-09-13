import {ConnectionHelper, SocketCallback} from "./connection_helper";
import * as net from "net";
import {loggerFor, debugFor} from "../utils/logger";
import {AuthorisationHelper} from "./authorisation_helper";

const logger = loggerFor('DynamicConnector');
const debug = debugFor('syncrow:con:dynamic_connector');

export default class DynamicConnector implements ConnectionHelper {

    constructor(private authorisationTimeout:number) {
    }

    public shutdown() {
    }

    /**
     * @param params
     * @param callback
     */
    public getNewSocket(params:{remoteHost:string, remotePort:number, token?:string}, callback:SocketCallback):any {
        try {
            DynamicConnector.validateParams(params);
        } catch (e) {
            return setImmediate(callback, e);
        }

        debug(`#getNewSocket - starting connecting to: ${params.remoteHost}:${params.remotePort}`);
        const socket = net.connect(
            {
                port: params.remotePort,
                host: params.remoteHost
            },
            (err)=> {
                if (err)return callback(err);

                if (!params.token) {

                    debug(`#getNewSocket - finished connecting to: ${params.remoteHost}:${params.remotePort} without authorisation`);
                    return callback(null, socket);
                }

                debug(`#getNewSocket - starting authorisation during connecting to: ${params.remoteHost}:${params.remotePort} with token ${params.token}`);
                return AuthorisationHelper.authorizeAsClient(socket,
                    params.token,
                    {timeout: this.authorisationTimeout},
                    (err)=> {
                        if (err)return callback(err);

                        debug(`#getNewSocket - finished connecting to: ${params.remoteHost}:${params.remotePort} with token ${params.token}`);
                        return callback(null, socket);
                    }
                )
            }
        );
    }

    private static validateParams(params:{remoteHost:string, remotePort:number, token?:string}) {
        if (!params.remoteHost) throw new Error('Remote host is needed for dynamic connection');
        if (!params.remotePort) throw new Error('Remote port is needed for dynamic connection');
    }
}