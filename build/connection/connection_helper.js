var net_1 = require("net");
var logger_1 = require("../utils/logger");
var authorisation_helper_1 = require("./authorisation_helper");
var async = require("async");
var _ = require("lodash");
var debug = logger_1.debugFor("syncrow:connection:helper");
var logger = logger_1.loggerFor('ConnectionHelper');
var DEFAULT_TIMEOUT = 5000;
var ConnectionHelper = (function () {
    /**
     * @param params
     */
    function ConnectionHelper(params) {
        this.params = this.validateAndUpdateParams(params);
        this.oneTimeServers = new Set();
    }
    /**
     * Disables the helper, calls any remaining callback with error
     */
    ConnectionHelper.prototype.shutdown = function () {
        logger.info('Connection Helper closing');
        this.killServer();
        this.oneTimeServers.forEach(function (s) { return s.close(); });
    };
    /**
     * @param callback
     * @param params
     */
    ConnectionHelper.prototype.setupServer = function (callback, params) {
        try {
            params = this.validateAndUpdateParams(params);
        }
        catch (e) {
            return callback(e);
        }
        return this.createLastingServer(params, callback);
    };
    /**
     * @param params
     * @param callback
     */
    ConnectionHelper.prototype.getNewSocket = function (callback, params) {
        var _this = this;
        try {
            params = this.validateAndUpdateParams(params);
        }
        catch (e) {
            return callback(e);
        }
        if (this.server) {
            if (this.serverCallback)
                logger.error('Overwriting an existing callback');
            return this.serverCallback = this.createServerCallback(callback, params);
        }
        if (params.listen) {
            return this.createOneTimeServerAndHandleConnection(params, params.listenCallback, callback);
        }
        if (params.times && params.interval) {
            return async.retry({ times: params.times, interval: params.interval }, function (cb) { return _this.getSocketByConnecting(params, cb); }, callback);
        }
        return this.getSocketByConnecting(params, callback);
    };
    ConnectionHelper.prototype.validateAndUpdateParams = function (params) {
        params = params ? params : {};
        if (!params.override) {
            params = _.extend(this.params, params);
        }
        if (params.authenticate && !params.token) {
            params.token = authorisation_helper_1.AuthorisationHelper.generateToken();
        }
        if (params.token && !params.timeout) {
            params.timeout = DEFAULT_TIMEOUT;
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
        if (params.listen && !params.localHost) {
            throw new Error('server is listening but local host is not provided');
        }
        if (params.times || params.interval) {
            if (!params.times)
                throw new Error('times needed when interval is set');
            if (!params.interval)
                throw new Error('interval needed when times is set');
        }
        return params;
    };
    ConnectionHelper.prototype.createServerCallback = function (callback, params) {
        var _this = this;
        return function (err, socket) {
            if (err) {
                delete _this.serverCallback;
                return callback(err);
            }
            return _this.handleIncomingSocket(socket, params, function (err, socket) {
                delete _this.serverCallback;
                return callback(err, socket);
            });
        };
    };
    ConnectionHelper.prototype.getSocketByConnecting = function (params, callback) {
        debug("getting a socket by connecting");
        var socket = net_1.connect({ port: params.remotePort, host: params.remoteHost }, function (err) {
            if (err)
                return callback(err);
            if (params.token) {
                return authorisation_helper_1.AuthorisationHelper.authorizeAsClient(socket, params.token, { timeout: params.timeout }, function (err) {
                    if (err)
                        return callback(err);
                    return callback(null, socket);
                });
            }
            return callback(null, socket);
        });
        socket.on('error', callback);
    };
    ConnectionHelper.prototype.createOneTimeServerAndHandleConnection = function (params, listenCallback, connectedCallback) {
        var _this = this;
        debug("creating new one time server on port: " + params.localPort);
        return this.createNewServer(params, function (server) {
            _this.oneTimeServers.add(server);
            listenCallback({
                remotePort: server.address().port,
                remoteHost: params.localHost,
                token: params.token
            });
            server.on('connection', function (socket) { return _this.handleIncomingSocket(socket, params, function (err, socket) {
                if (err)
                    return connectedCallback(err);
                debug('Got a new socket - closing the one time server');
                _this.oneTimeServers.delete(server);
                server.close();
                return connectedCallback(null, socket);
            }); });
            server.on('error', connectedCallback);
        });
    };
    ConnectionHelper.prototype.createLastingServer = function (params, callback) {
        var _this = this;
        return this.createNewServer(params, function (server) {
            _this.server = server;
            _this.server.on('connection', function (socket) {
                var serverCallback = _this.serverCallback;
                if (serverCallback) {
                    delete _this.serverCallback;
                    return serverCallback(null, socket);
                }
                logger.error('Got a socket that was not ordered - it will be rejected');
                return socket.destroy();
            });
            _this.server.on('error', function (err) {
                var serverCallback = _this.serverCallback;
                if (serverCallback) {
                    serverCallback(err);
                    delete _this.serverCallback;
                }
                else
                    logger.error("Server emitted error: " + err);
                _this.killServer();
            });
            return callback();
        });
    };
    ConnectionHelper.prototype.createNewServer = function (params, callback) {
        var listenOptions = {};
        if (params.localPort)
            listenOptions.port = params.localPort;
        if (listenOptions.port) {
            var server = net_1.createServer().listen(listenOptions, function () { return callback(server); });
        }
        else {
            var server = net_1.createServer().listen(function () { return callback(server); });
        }
    };
    ConnectionHelper.prototype.handleIncomingSocket = function (socket, params, connectedCallback) {
        if (params.token) {
            return authorisation_helper_1.AuthorisationHelper.authorizeAsServer(socket, params.token, { timeout: params.timeout }, function (err) {
                if (err)
                    return connectedCallback(err);
                return connectedCallback(null, socket);
            });
        }
        return connectedCallback(null, socket);
    };
    ConnectionHelper.prototype.killServer = function () {
        if (this.server)
            this.server.close();
        delete this.server;
        delete this.serverCallback;
    };
    return ConnectionHelper;
})();
exports.ConnectionHelper = ConnectionHelper;
//# sourceMappingURL=connection_helper.js.map