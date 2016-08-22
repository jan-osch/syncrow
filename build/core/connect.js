var file_container_1 = require("../fs_helpers/file_container");
var connection_helper_1 = require("../connection/connection_helper");
var transfer_helper_1 = require("../transport/transfer_helper");
var engine_1 = require("./engine");
var event_messenger_1 = require("../connection/event_messenger");
var async = require("async");
var logger_1 = require("../utils/logger");
var debug = logger_1.debugFor('syncrow:connect');
/**
 * @param {Number} remotePort
 * @param {String} remoteHost
 * @param {String} path
 * @param {ConnectOptions} options
 * @param {EngineCallback} callback
 */
function startConnectingEngine(remotePort, remoteHost, path, options, callback) {
    var container = new file_container_1.FileContainer(path, { filter: options.filter });
    var connectionHelperEntry = new connection_helper_1.ConnectionHelper({
        remotePort: remotePort,
        remoteHost: remoteHost,
        listen: false,
        token: options.initialToken,
        interval: options.interval,
        times: options.times,
    });
    var connectionHelperForTransfer = new connection_helper_1.ConnectionHelper({
        remotePort: remotePort,
        remoteHost: remoteHost,
        listen: false,
        authenticate: options.authenticate
    });
    var transferHelper = new transfer_helper_1.TransferHelper(container, connectionHelperForTransfer, {
        name: 'ConnectingEngine',
        preferConnecting: true
    });
    var engine = new engine_1.Engine(container, transferHelper, { sync: options.sync });
    engine.on(engine_1.Engine.events.shutdown, function () {
        connectionHelperForTransfer.shutdown();
        connectionHelperEntry.shutdown();
    });
    return async.waterfall([
        function (cb) {
            if (options.watch)
                return container.beginWatching(cb);
            cb();
        },
        function (cb) { return connectionHelperEntry.getNewSocket(cb); },
        function (socket, cb) {
            var eventMessenger = new event_messenger_1.EventMessenger(socket);
            engine.addOtherPartyMessenger(eventMessenger);
            if (options.interval && options.times) {
                connectAgainAfterPreviousDied(eventMessenger, engine, connectionHelperEntry);
            }
            return cb(null, engine);
        }
    ], callback);
}
exports.default = startConnectingEngine;
function connectAgainAfterPreviousDied(previousMessenger, engine, connectionHelper) {
    previousMessenger.on(event_messenger_1.EventMessenger.events.died, function () {
        debug("obtaining new socket");
        connectionHelper.getNewSocket(function (err, socket) {
            if (err) {
                return engine.emit(engine_1.Engine.events.error, err);
            }
            var eventMessenger = new event_messenger_1.EventMessenger(socket);
            engine.addOtherPartyMessenger(eventMessenger);
            connectAgainAfterPreviousDied(eventMessenger, engine, connectionHelper);
        });
    });
}
//# sourceMappingURL=connect.js.map