var parse_helper_1 = require("./parse_helper");
var async = require("async");
var logger_1 = require("../utils/logger");
var crypto = require("crypto");
var debug = logger_1.debugFor('syncrow:connection:authorisation_helper');
var AuthorisationHelper = (function () {
    function AuthorisationHelper() {
    }
    /**
     * @param socket
     * @param token
     * @param options
     * @param callback
     */
    AuthorisationHelper.authorizeAsClient = function (socket, token, options, callback) {
        var parser = new parse_helper_1.ParseHelper(socket);
        var wrapped = async.timeout(function (cb) {
            parser.once(parse_helper_1.ParseHelper.events.message, function (message) { return AuthorisationHelper.handleExpectedHandshakeResponse(message, cb); });
            var handshake = {
                type: AuthorisationHelper.messages.handshake,
                token: token
            };
            AuthorisationHelper.writeToParser(parser, handshake);
        }, options.timeout, new Error('Authorisation timeout'));
        wrapped(function (err) {
            parser.shutdown();
            return callback(err);
        });
    };
    /**
     * @param socket
     * @param token
     * @param options
     * @param callback
     */
    AuthorisationHelper.authorizeAsServer = function (socket, token, options, callback) {
        var parser = new parse_helper_1.ParseHelper(socket);
        debug("authorizeSocket called");
        var wrapped = async.timeout(function (cb) {
            parser.once(parse_helper_1.ParseHelper.events.message, function (message) { return AuthorisationHelper.handleExpectedHandshake(message, token, cb); });
        }, options.timeout, new Error('Authorisation timeout'));
        wrapped(function (err) {
            if (err) {
                AuthorisationHelper.writeToParser(parser, {
                    type: AuthorisationHelper.messages.handshakeResponse,
                    success: false,
                    reason: err
                });
            }
            else {
                AuthorisationHelper.writeToParser(parser, {
                    type: AuthorisationHelper.messages.handshakeResponse,
                    success: true
                });
            }
            parser.shutdown();
            return callback(err);
        });
    };
    /**
     * Generates new token for authorisation
     */
    AuthorisationHelper.generateToken = function () {
        return crypto.createHash('sha256')
            .update(Math.random().toString())
            .digest('hex');
    };
    AuthorisationHelper.handleExpectedHandshakeResponse = function (rawMessage, callback) {
        debug("handleExpectedHandshakeResponse - got raw message: " + rawMessage);
        try {
            var parsed = JSON.parse(rawMessage);
            if (parsed.type === AuthorisationHelper.messages.handshakeResponse) {
                if (parsed.success) {
                    return callback();
                }
                return callback(parsed.reason);
            }
            return callback(new Error("Unrecognised message type: " + parsed.type));
        }
        catch (e) {
            return callback(new Error("Malformed message - reason: " + e));
        }
    };
    AuthorisationHelper.handleExpectedHandshake = function (rawMessage, token, callback) {
        debug("got handleExpectedHandshake - got raw message: " + rawMessage);
        var parsed;
        try {
            parsed = JSON.parse(rawMessage);
        }
        catch (e) {
            return callback(new Error("Malformed message - reason: " + e));
        }
        if (parsed.type === AuthorisationHelper.messages.handshake) {
            return this.checkToken(parsed, token, callback);
        }
        return callback(new Error("Unrecognised message type: " + parsed.type));
    };
    AuthorisationHelper.checkToken = function (parsed, token, callback) {
        var tokenMatches = parsed.token === token;
        debug("handleExpectedHandshake - token matches: " + tokenMatches);
        if (!tokenMatches)
            return callback(new Error("Invalid token: " + parsed.token));
        return callback();
    };
    AuthorisationHelper.writeToParser = function (parser, data) {
        parser.writeMessage(JSON.stringify(data));
    };
    AuthorisationHelper.messages = {
        handshake: 'handshake',
        handshakeResponse: 'handshake',
        error: 'error'
    };
    return AuthorisationHelper;
})();
exports.AuthorisationHelper = AuthorisationHelper;
//# sourceMappingURL=authorisation_helper.js.map