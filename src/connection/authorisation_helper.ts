import {Socket} from "net";
import * as async from "async";
import {debugFor} from "../utils/logger";
import {ErrorCallback} from "../utils/interfaces";
import * as crypto from "crypto";

const debug = debugFor('syncrow:con:authorisation_helper');

export class AuthorisationHelper {


    /**
     * @param socket
     * @param token
     * @param options
     * @param callback
     */
    public static authorizeAsClient(socket:Socket, token:string, options:{timeout:number}, callback:ErrorCallback) {
        debug(`authorizeAsClient with token: ${token} called`);

        try {
            socket.write(token);
        } catch (e) {
            return callback(e);
        }

        return setTimeout(
            ()=> {
                if (socket.destroyed) {
                    return callback(new Error('Socket has been destroyed - authorization failed'));
                }

                return callback();
            },
            options.timeout
        )
    }

    /**
     * @param socket
     * @param token
     * @param options
     * @param callback - if error is passed to callback the socket should be destroyed
     */
    public static authorizeAsServer(socket:Socket, token:string, options:{timeout:number}, callback:ErrorCallback) {

        debug(`#authorizeAsServer with token: ${token} called`);

        const wrapped = async.timeout(
            (cb)=> {
                socket.once('data',
                    (data)=> {
                        debug(`#authorizeAsServer - got data: ${data}`);

                        const expectedToken = data.toString();

                        if (expectedToken !== token) {
                            debug(`#authorizeAsServer - token does not match: ${expectedToken} vs ${token}`);
                            return cb(new Error(`token: ${data} does not match: ${token}`));
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
