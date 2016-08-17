import {Socket} from "net";
import {ParseHelper} from "./parse_helper";
import * as async from "async";
import {debugFor} from "../utils/logger";
import * as crypto from "crypto";

const debug = debugFor('syncrow:connection:authorisation_helper');

export class AuthorisationHelper {

    static messages = {
        handshake: 'handshake',
        handshakeResponse: 'handshake',
        error: 'error'
    };

    /**
     * @param socket
     * @param token
     * @param options
     * @param callback
     */
    public static authorizeAsClient(socket:Socket, token:string, options:{timeout:number}, callback:ErrorCallback) {
        const parser = new ParseHelper(socket);

        const wrapped = async.timeout(
            (cb)=> {

                parser.once(ParseHelper.events.message,
                    (message)=> AuthorisationHelper.handleExpectedHandshakeResponse(message, cb)
                );

                const handshake = {
                    type: AuthorisationHelper.messages.handshake,
                    token: token
                };

                AuthorisationHelper.writeToParser(parser, handshake);
            },
            options.timeout,
            new Error('Authorisation timeout')
        );

        wrapped((err)=> {
            parser.shutdown();
            return callback(err);
        })

    }

    /**
     * @param socket
     * @param token
     * @param options
     * @param callback
     */
    public static authorizeAsServer(socket:Socket, token:string, options:{timeout:number}, callback:ErrorCallback) {
        const parser = new ParseHelper(socket);

        debug(`authorizeSocket called`);

        const wrapped = async.timeout(
            (cb)=> {
                parser.once(ParseHelper.events.message,
                    (message)=> AuthorisationHelper.handleExpectedHandshake(message, token, cb)
                );
            },
            options.timeout,
            new Error('Authorisation timeout')
        );

        wrapped((err:Error)=> {
                if (err) {
                    AuthorisationHelper.writeToParser(parser,
                        {
                            type: AuthorisationHelper.messages.handshakeResponse,
                            success: false,
                            reason: err
                        }
                    );
                } else {
                    AuthorisationHelper.writeToParser(parser,
                        {
                            type: AuthorisationHelper.messages.handshakeResponse,
                            success: true
                        }
                    );
                }
                parser.shutdown();
                return callback(err);
            }
        );
    }

    /**
     * Generates new token for authorisation
     */
    public static generateToken():string {
        return crypto.createHash('sha256')
            .update(Math.random().toString())
            .digest('hex');
    }

    private static handleExpectedHandshakeResponse(rawMessage:string, callback:ErrorCallback) {
        debug(`handleExpectedHandshakeResponse - got raw message: ${rawMessage}`);

        try {
            const parsed = JSON.parse(rawMessage);

            if (parsed.type === AuthorisationHelper.messages.handshakeResponse) {
                if (parsed.success) {
                    return callback();
                }
                return callback(parsed.reason);
            }

            return callback(new Error(`Unrecognised message type: ${parsed.type}`));
        } catch (e) {
            return callback(new Error(`Malformed message - reason: ${e}`));
        }
    }

    private static handleExpectedHandshake(rawMessage:string, token:string, callback:ErrorCallback) {
        debug(`got handleExpectedHandshake - got raw message: ${rawMessage}`);

        let parsed;

        try {
            parsed = JSON.parse(rawMessage);
        } catch (e) {
            return callback(new Error(`Malformed message - reason: ${e}`));
        }

        if (parsed.type === AuthorisationHelper.messages.handshake) {
            return this.checkToken(parsed, token, callback);
        }

        return callback(new Error(`Unrecognised message type: ${parsed.type}`));

    }

    private static checkToken(parsed:any, token:string, callback:ErrorCallback) {
        const tokenMatches = parsed.token === token;
        debug(`handleExpectedHandshake - token matches: ${tokenMatches}`);

        if (!tokenMatches)return callback(new Error(`Invalid token: ${parsed.token}`));

        return callback();
    }

    private static writeToParser(parser:ParseHelper, data:any) {
        parser.writeMessage(JSON.stringify(data));
    }

}
