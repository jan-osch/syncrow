var logger_1 = require("../utils/logger");
var generic_commands_action_1 = require("./generic_commands_action");
var debug = logger_1.debugFor('syncrow:sync:push');
var logger = logger_1.loggerFor('PushAction');
/**
 * It will push all files to remote.
 *
 * @param params
 * @param callback
 */
function pushAction(params, callback) {
    return generic_commands_action_1.genericCommandsAction(params, callback, issueCommands);
}
exports.pushAction = pushAction;
function issueCommands(params, metaTuple, callback) {
    if (metaTuple.localMeta.exists && !metaTuple.remoteMeta.exists) {
        if (metaTuple.localMeta.isDirectory) {
            params.subject.createRemoteDirectory(params.remoteParty, metaTuple.localMeta.name);
            return callback();
        }
        return params.subject.pushFileToRemote(params.remoteParty, metaTuple.localMeta.name, callback);
    }
    if (metaTuple.localMeta.exists && metaTuple.remoteMeta.exists) {
        if (params.deleteRemoteIfLocalMissing) {
            params.subject.deleteRemoteFile(params.remoteParty, metaTuple.localMeta.name);
            return callback();
        }
        debug("File: " + metaTuple.localMeta.name + " exists locally but does not remotely - it will be ignored");
        return callback();
    }
    if (metaTuple.remoteMeta.exists && metaTuple.localMeta.exists) {
        if (metaTuple.localMeta.isDirectory) {
            return callback();
        }
        if (metaTuple.localMeta.hashCode === metaTuple.remoteMeta.hashCode) {
            return callback();
        }
        return params.subject.pushFileToRemote(params.remoteParty, metaTuple.localMeta.name, callback);
    }
    logger.warn("File " + metaTuple.localMeta.name + " - does not exist locally or remotely");
    return callback();
}
//# sourceMappingURL=push_action.js.map