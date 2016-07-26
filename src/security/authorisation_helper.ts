import {Socket} from "net";
import {ParseHelper} from "../connection/parse_helper";
import {loggerFor} from "../utils/logger";

const logger = loggerFor('AuthorisationHelper');

interface AuthorisationCallback {
    (result:boolean):any
}

interface WrappedCallback {
    (err?:Error):any
}

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
    public static authorizeToSocket(socket:Socket, token:any, options:{timeout:number}, callback:AuthorisationCallback) {
        const parser = new ParseHelper(socket);

        const wrapped = async.timeout(
            (err:Error)=> {
                let result = true;
                if (err) {
                    logger.error(`Authorisation failed - reason: ${err}`);
                }
                parser.shutdown();
                return callback(result);
            },
            options.timeout, new Error('Authorisation timeout')
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
    public static authorizeSocket(socket:Socket, token:any, options:{timeout:number}, callback:AuthorisationCallback) {
        const parser = new ParseHelper(socket);

        const wrapped = async.timeout(
            (err:Error)=> {
                let result = true;
                if (err) {
                    AuthorisationHelper.writeToParser(parser,
                        {
                            type: AuthorisationHelper.messages.handshakeResponse,
                            success: false,
                            reason: err
                        }
                    );
                    result = false;
                }
                parser.shutdown();
                return callback(result);
            },
            options.timeout, new Error('Authorisation timeout')
        );

        parser.once(ParseHelper.events.message,
            (message)=> AuthorisationHelper.handleExpectedHandshake(message, token, wrapped)
        );
    }

    private static handleExpectedHandshakeResponse(rawMessage:string, callback:WrappedCallback) {
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

    private static handleExpectedHandshake(rawMessage:string, token:string, callback:WrappedCallback) {
        try {
            const parsed = JSON.parse(rawMessage);
            if (parsed.type === AuthorisationHelper.messages.handshake) {
                const tokenMatches = parsed.token === token;

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
