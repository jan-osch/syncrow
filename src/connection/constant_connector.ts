import {ConnectionHelper, SocketCallback} from "./connection_helper";
import * as net from "net";
import {loggerFor, debugFor} from "../utils/logger";
import {AuthorisationHelper} from "./authorisation_helper";

const logger = loggerFor('ConstantConnector');
const debug = debugFor('syncrow:con:constant_connector');

export default class ConstantConnector implements ConnectionHelper {

    constructor(private authTimeout:number, private remoteHost:string, private remotePort:number, private constantToken:string) {
    }

    public shutdown() {
    }

    /**
     * @param params
     * @param callback
     */
    public getNewSocket(params:{}, callback:SocketCallback):any {
        debug(`#getNewSocket - connecting to : ${this.remoteHost}:${this.remotePort}`);
        const socket = net.connect(
            {
                port: this.remotePort,
                host: this.remoteHost
            },
            (err)=> {
                if (err)return callback(err);

                if (!this.constantToken) {
                    debug(`#getNewSocket - finished without authorisation`);
                    return callback(null, socket);
                }

                debug(`#getNewSocket - starting connecting with token: ${this.constantToken}`);
                return AuthorisationHelper.authorizeAsClient(socket,
                    this.constantToken,
                    {timeout: this.authTimeout},

                    (err)=> {
                        if (err)return callback(err);

                        debug(`#getNewSocket - finished connecting with token: ${this.constantToken}`);
                        return callback(null, socket);
                    }
                )
            }
        ).on('error',callback);
    }

}