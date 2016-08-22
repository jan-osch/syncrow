var file_container_1 = require("../fs_helpers/file_container");
var connection_helper_1 = require("../connection/connection_helper");
var transfer_helper_1 = require("../transport/transfer_helper");
var engine_1 = require("./engine");
var event_messenger_1 = require("../connection/event_messenger");
var async = require("async");
var _ = require("lodash");
//TODO make the order of parameters the same as in connect
/**
 * @param path
 * @param {Number} port
 * @param {ListenOptions} options
 * @param {EngineCallback} callback
 */
function startListeningEngine(path, port, options, callback) {
    var container = new file_container_1.FileContainer(path, { filter: options.filterFunction });
    var connectionHelperEntry = new connection_helper_1.ConnectionHelper({
        localPort: port,
        localHost: options.externalHost,
        listen: true,
        listenCallback: _.noop,
        token: options.initialToken
    });
    var connectionHelperForTransfer = new connection_helper_1.ConnectionHelper({
        localHost: options.externalHost,
        listen: true,
        listenCallback: _.noop,
        authenticate: options.authenticate
    });
    var transferHelper = new transfer_helper_1.TransferHelper(container, connectionHelperForTransfer, {
        name: 'ListeningEngine',
        preferConnecting: false
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
            return cb();
        },
        function (cb) { return connectionHelperEntry.setupServer(cb); }
    ], function (err) {
        if (err)
            return callback(err);
        listenForMultipleConnections(engine, connectionHelperEntry);
        return callback(null, engine);
    });
}
exports.default = startListeningEngine;
function listenForMultipleConnections(engine, helper) {
    return async.whilst(function () { return true; }, function (cb) {
        return helper.getNewSocket(function (err, socket) {
            if (err) {
                engine.emit(engine_1.Engine.events.error, err);
                return cb();
            }
            engine.addOtherPartyMessenger(new event_messenger_1.EventMessenger(socket));
            return cb();
        });
    }, function (err) {
        if (err)
            engine.emit(engine_1.Engine.events.error, err);
    });
}
//# sourceMappingURL=listen.js.map