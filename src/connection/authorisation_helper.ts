import {Socket} from "net";
import * as async from "async";
import {debugFor} from "../utils/logger";
import {ErrorCallback} from "../utils/interfaces";
import * as crypto from "crypto";

const debug = debugFor('syncrow:con:authorisation_helper');

export class AuthorisationHelper {


    //TODO implement proper timeout
    /**
     * @param socket
     * @param token
     */
    public static authorizeAsClient(socket:Socket, token:string) {
        debug(`authorizeAsClient with token: ${token} called`);

        socket.write(token);
    }

    /**
     * @param socket
     * @param token
     * @param options
     * @param callback - if error is passed to callback the socket should be destroyed
     */
    public static authorizeAsServer(socket:Socket, token:string, options:{timeout:number}, callback:ErrorCallback) {

        debug(`authorizeSocket with token: ${token} called`);

        const wrapped = async.timeout(
            (cb)=> {
                socket.once('data',
                    (expectedToken)=> {
                        if (expectedToken.toString() !== token) {
                            return cb(new Error(`token: ${expectedToken} does not match: ${token}`));
                        }

                        return cb();
                    }
                );
            },
            options.timeout,
            new Error('Authorisation timeout')
        );

        wrapped((err)=> {
            socket.removeAllListeners('data');
            return callback(err);
        });
    }

    /**
     * Generates new token for authorisation
     */
    public static generateToken():string {
        return crypto.createHash('sha256')
            .update(Math.random().toString())
            .digest('hex');
    }
}
