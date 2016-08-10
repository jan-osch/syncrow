import {Socket} from "net";
import {ParseHelper} from "./parse_helper";
import * as crypto from "crypto";
import {timeout} from "../utils/timeout";
import {debugFor} from "../utils/logger";

const debug = debugFor('syncrow:connection:authorisation_helper')

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
    public static authorizeToSocket(socket:Socket, token:string, options:{timeout:number}, callback:ErrorCallback) {
        const parser = new ParseHelper(socket);

        const wrapped = timeout(
            (err:Error)=> {
                parser.shutdown();
                return callback(err);
            },
            options.timeout,
            new Error('Authorisation timeout')
        );

        parser.once(ParseHelper.events.message,
            (message)=> AuthorisationHelper.handleExpectedHandshakeResponse(message, wrapped)
        );

        const handshake = {
            type: AuthorisationHelper.messages.handshake,
            token: token
        };

        AuthorisationHelper.writeToParser(parser, handshake);
    }

    /**
     * @param socket
     * @param token
     * @param options
     * @param callback
     */
    public static authorizeSocket(socket:Socket, token:string, options:{timeout:number}, callback:ErrorCallback) {
        const parser = new ParseHelper(socket);

        const wrapped = timeout(
            (err:Error)=> {
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
            },
            options.timeout,
            new Error('Authorisation timeout')
        );

        parser.once(ParseHelper.events.message,
            (message)=> AuthorisationHelper.handleExpectedHandshake(message, token, wrapped)
        );
    }

    /**
     * @param secret
     */
    public static generateToken(secret?:string):string {
        const hash = crypto.createHmac('sha256', secret)
            .update(Math.random().toString())
            .digest('hex');

        return hash;
    }

    private static handleExpectedHandshakeResponse(rawMessage:string, callback:ErrorCallback) {
        try {
            debug(`handleExpectedHandshakeResponse - got raw message: ${rawMessage}`);
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
        try {
            debug(`got handleExpectedHandshake - got raw message: ${rawMessage}`);
            const parsed = JSON.parse(rawMessage);
            if (parsed.type === AuthorisationHelper.messages.handshake) {
                const tokenMatches = parsed.token === token;
                debug(`handleExpectedHandshake - token matches: ${tokenMatches}`);

                if (!tokenMatches) return callback(new Error(`Invalid token: ${parsed.token}`));
                return callback();
            }
            return callback(new Error(`Unrecognised message type: ${parsed.type}`));
        } catch (e) {
            return callback(new Error(`Malformed message - reason: ${e}`));
        }
    }

    private static writeToParser(parser:ParseHelper, data:any) {
        parser.writeMessage(JSON.stringify(data));
    }

}
